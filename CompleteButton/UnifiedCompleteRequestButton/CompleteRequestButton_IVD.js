/**
 * Complete Request Button - IVD Handler
 * LOB-specific logic for IVD (Income Verification Division)
 */
"use strict";

(function() {
    var IVDHandler = {
        name: "IVD",
        
        // IVD-specific configuration
        config: {
            // No additional config needed - uses base workflows
        },
        
        // IVD-specific state
        state: {
            verificationMethod: null,
            icn: null,
            radDate: null,
            reevaluateDate: null,
            enrollmentStatus: null
        },
        
        /**
         * Load IVD-specific form data
         */
        loadFormData: function(base) {
            this.state.radDate = ButtonBase.getAttributeValue("vhacrm_raddate_date");
            this.state.reevaluateDate = ButtonBase.getAttributeValue("vhacrm_reevaluatedate_date");
            this.state.icn = ButtonBase.getAttributeValue("vhacrm_icn_text");
        },
        
        /**
         * Load verification method via API
         */
        loadVerificationMethod: async function(base) {
            const requestId = base.state.request.id;
            if (!requestId) return;
            
            try {
                const result = await ButtonBase.retrieveRecord(
                    "incident",
                    requestId,
                    "?$select=_vhacrm_verificationmethodid_value"
                );
                
                if (result._vhacrm_verificationmethodid_value) {
                    this.state.verificationMethod = {
                        id: result._vhacrm_verificationmethodid_value,
                        name: result["_vhacrm_verificationmethodid_value@OData.Community.Display.V1.FormattedValue"] || "",
                        entityType: result["_vhacrm_verificationmethodid_value@Microsoft.Dynamics.CRM.lookuplogicalname"] || "vhacrm_verificationmethod"
                    };
                } else {
                    this.state.verificationMethod = null;
                }
            } catch (error) {
                console.error("Error loading verification method:", error);
                this.state.verificationMethod = null;
            }
        },
        
        /**
         * Run IVD-specific validations
         */
        runValidations: function(base) {
            // Start with base validations
            const errors = base.runBaseValidations();
            
            // Skip additional validations for Created in Error
            if (base.state.flags.isCreatedInError) {
                return errors;
            }
            
            // Verification Method is required
            if (!this.state.verificationMethod) {
                errors.push("Verification Method is required to complete the request.");
            }
            
            // Pending Future RAD validations
            if (base.state.flags.isPendingFutureRAD) {
                if (!this.state.radDate) {
                    errors.push("RAD Date is required to complete the request.");
                }
                if (!this.state.reevaluateDate) {
                    errors.push("Reevaluate Date is required to complete the request.");
                }
            }
            
            return errors;
        },
        
        /**
         * Call enrollment status API
         */
        callEnrollmentStatusAPI: async function(base) {
            if (!this.state.icn) return;
            
            try {
                const endpoint = await ButtonBase.getKeyValuePair("esr_endpoint");
                if (!endpoint) return;
                
                const url = endpoint.replace("{0}", this.state.icn);
                
                const response = await fetch(url);
                if (response.ok) {
                    const json = await response.json();
                    this.state.enrollmentStatus = json.Data?.EnrollmentDeterminationInfo?.EnrollmentStatus || "";
                }
            } catch (error) {
                console.error("Error calling enrollment status API:", error);
            }
        },
        
        /**
         * Update request record with IVD-specific fields
         */
        updateRequestRecord: async function(base) {
            try {
                const baseUrl = await ButtonBase.getKeyValuePair("base_url");
                const recordUrl = baseUrl 
                    ? `${baseUrl}main.aspx?etn=incident&id=${base.state.request.id}&pagetype=entityrecord`
                    : "";
                
                await ButtonBase.updateRecord("incident", base.state.request.id, {
                    vhacrm_recordurl_memo: recordUrl,
                    vhacrm_enrollmentstatus_text: this.state.enrollmentStatus || ""
                });
                
                console.log("IVD request record updated");
            } catch (error) {
                console.error("Error updating request record:", error);
            }
        },
        
        /**
         * Main execution for IVD
         */
        execute: async function(base) {
            // Load IVD-specific data
            this.loadFormData(base);
            await this.loadVerificationMethod(base);
            
            // Run validations
            const validationErrors = this.runValidations(base);
            
            if (validationErrors.length > 0) {
                base.showError(validationErrors.join(" | "));
                return;
            }
            
            // Call enrollment status API
            await this.callEnrollmentStatusAPI(base);
            
            // Update request record
            await this.updateRequestRecord(base);
            
            // Update HEC Alert if linked
            await base.updateHecAlert();
            
            // Execute complete workflow
            await ButtonBase.executeWorkflow(base.config.workflows.completeRequest, base.state.request.id);
            
            // Save and close
            await ButtonBase.saveAndClose();
        }
    };
    
    // Register with base module
    CompleteRequestButton.registerLOB("IVD", IVDHandler);
})();
