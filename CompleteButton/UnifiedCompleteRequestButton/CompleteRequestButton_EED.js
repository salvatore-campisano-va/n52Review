/**
 * Complete Request Button - EED Handler
 * LOB-specific logic for EED (Enrollment Eligibility Division)
 */
"use strict";

(function() {
    var EEDHandler = {
        name: "EED",
        
        // EED-specific configuration
        config: {
            // Case note type code
            caseNoteTypeCode: 168790000,
            
            // Placeholder Veteran GUID (No Veteran, No Veteran)
            placeholderVeteranId: "1b8680e1-8d87-e611-9422-0050568dade6"
        },
        
        // EED-specific state
        state: {
            type: null,
            area: null,
            subArea: null,
            verificationMethod: null,
            caseNoteMemo: null,
            caseNoteTemplate: null,
            radDate: null,
            reevaluateDate: null,
            noContactRequired: null,
            isPlaceholderVeteran: false,
            caseNoteExistsToday: false,
            counts: {
                correspondence: 0,
                phoneCalls: 0
            }
        },
        
        /**
         * Load EED-specific form data
         */
        loadFormData: function(base) {
            this.state.type = ButtonBase.getLookupValue("vhacrm_typeintersectionid");
            this.state.area = ButtonBase.getLookupValue("vhacrm_areaintersectionid");
            this.state.subArea = ButtonBase.getLookupValue("vhacrm_subareaintersectionid");
            this.state.verificationMethod = ButtonBase.getLookupValue("vhacrm_verificationmethodid");
            this.state.caseNoteMemo = ButtonBase.getAttributeValue("vhacrm_casenotes_memo");
            this.state.caseNoteTemplate = ButtonBase.getLookupValue("vhacrm_casenotetemplateid");
            this.state.radDate = ButtonBase.getAttributeValue("vhacrm_raddate_date");
            this.state.reevaluateDate = ButtonBase.getAttributeValue("vhacrm_reevaluatedate_date");
            this.state.noContactRequired = ButtonBase.getAttributeValue("vhacrm_nocontactrequired_bool");
            
            // Set placeholder veteran flag
            if (base.state.request.veteran) {
                this.state.isPlaceholderVeteran = 
                    ButtonBase.cleanGuid(base.state.request.veteran.id) === this.config.placeholderVeteranId;
            }
        },
        
        /**
         * Load activity counts (correspondence and phone calls)
         */
        loadActivityCounts: async function(base) {
            const requestId = base.state.request.id;
            
            try {
                const [correspondenceResult, phoneCallResult] = await Promise.all([
                    this.getRelatedEntityCount(base, "vhacrm_correspondence", requestId),
                    this.getPhoneCallCount(base, requestId)
                ]);
                
                this.state.counts.correspondence = correspondenceResult;
                this.state.counts.phoneCalls = phoneCallResult;
            } catch (error) {
                console.error("Error loading activity counts:", error);
                this.state.counts.correspondence = 0;
                this.state.counts.phoneCalls = 0;
            }
        },
        
        getRelatedEntityCount: async function(base, entityName, requestId) {
            try {
                const result = await ButtonBase.retrieveMultipleRecords(
                    entityName,
                    `?$filter=_vhacrm_requestid_value eq '${requestId}'&$select=${entityName}id`
                );
                return result.entities.length;
            } catch (error) {
                console.error(`Error getting ${entityName} count:`, error);
                return 0;
            }
        },
        
        getPhoneCallCount: async function(base, requestId) {
            try {
                const result = await ButtonBase.retrieveMultipleRecords(
                    "phonecall",
                    `?$filter=_vhacrm_requestid_value eq '${requestId}'&$select=activityid`
                );
                return result.entities.length;
            } catch (error) {
                console.error("Error getting phone call count:", error);
                return 0;
            }
        },
        
        /**
         * Check if case note exists today by current user
         */
        checkCaseNoteExistsToday: async function(base) {
            const requestId = base.state.request.id;
            const ownerId = ButtonBase.getCurrentUserId();
            
            const todayRange = ButtonBase.getTodayRange();
            
            try {
                const result = await ButtonBase.retrieveMultipleRecords(
                    "vhacrm_casenote",
                    `?$select=vhacrm_casenoteid&$top=1&$filter=_vhacrm_requestid_value eq '${requestId}' and _createdby_value eq '${ownerId}' and createdon ge ${todayRange.start.toISOString()} and createdon le ${todayRange.end.toISOString()}`
                );
                this.state.caseNoteExistsToday = result.entities.length > 0;
            } catch (error) {
                console.error("Error checking case note existence:", error);
                this.state.caseNoteExistsToday = false;
            }
        },
        
        /**
         * Run EED-specific validations
         */
        runValidations: function(base) {
            const errors = [];
            
            // Skip validations for Created in Error
            if (base.state.flags.isCreatedInError) {
                return errors;
            }
            
            // Veteran is required unless customer is the placeholder veteran
            if (!this.state.isPlaceholderVeteran && !base.state.request.veteran) {
                errors.push("Veteran is required to complete the request.");
            }
            
            // Verification Method is required unless customer is placeholder veteran
            if (!this.state.isPlaceholderVeteran && !this.state.verificationMethod) {
                errors.push("Verification Method is required to complete the request.");
            }
            
            // Contact Method is required unless:
            // - No Contact Required flag is set
            // - Customer is placeholder veteran
            if (!this.state.isPlaceholderVeteran) {
                const hasContact = this.state.counts.correspondence > 0 || this.state.counts.phoneCalls > 0;
                if (!hasContact && !this.state.noContactRequired) {
                    errors.push("Veteran Contact Method is Required");
                }
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
            
            // Case Note is required (memo OR existing today)
            if (!this.state.caseNoteMemo && !this.state.caseNoteExistsToday) {
                errors.push("A completed Case Note is required to complete the request.");
            }
            
            return errors;
        },
        
        /**
         * Build case note name from LOB/Type/Area/SubArea
         */
        buildCaseNoteName: function(base) {
            let name = "";
            
            if (base.state.request.lob) {
                name = base.state.request.lob.name;
            }
            
            if (this.state.type) {
                name += (name ? "/" : "") + this.state.type.name;
            }
            
            if (this.state.area) {
                name += (name ? "/" : "") + this.state.area.name;
            }
            
            if (this.state.subArea) {
                name += (name ? "/" : "") + this.state.subArea.name;
            }
            
            return name;
        },
        
        /**
         * Create case note record
         */
        createCaseNote: async function(base) {
            if (!this.state.caseNoteMemo) return;
            if (!base.state.request.resolution) return;
            
            const caseNote = {
                vhacrm_name: this.buildCaseNoteName(base),
                vhacrm_casenotes_memo: this.state.caseNoteMemo,
                "vhacrm_requestid@odata.bind": `/incidents(${base.state.request.id})`,
                vhacrm_casenotetype_code: this.config.caseNoteTypeCode
            };
            
            // Add veteran if present
            if (base.state.request.veteran) {
                caseNote["vhacrm_veteranid@odata.bind"] = `/contacts(${ButtonBase.cleanGuid(base.state.request.veteran.id)})`;
            }
            
            // Add HEC Alert if present
            if (base.state.request.hecAlert) {
                caseNote["vhacrm_hecalertid@odata.bind"] = `/vhacrm_hecalerts(${ButtonBase.cleanGuid(base.state.request.hecAlert.id)})`;
            }
            
            // Add template if present
            if (this.state.caseNoteTemplate) {
                caseNote["vhacrm_casenotetemplateid@odata.bind"] = 
                    `/vhacrm_casenotetemplates(${ButtonBase.cleanGuid(this.state.caseNoteTemplate.id)})`;
            }
            
            try {
                await ButtonBase.createRecord("vhacrm_casenote", caseNote);
                console.log("Case note created successfully");
            } catch (error) {
                console.error("Error creating case note:", error);
                throw new Error("Failed to create case note.");
            }
        },
        
        /**
         * Update incident case note fields
         */
        updateIncidentCaseNoteFields: async function(base) {
            try {
                await ButtonBase.updateRecord("incident", base.state.request.id, {
                    vhacrm_casenotehidden: this.state.caseNoteMemo,
                    "vhacrm_casenotetemplateid@odata.bind": null
                });
                console.log("Incident case note fields updated");
            } catch (error) {
                console.error("Error updating incident case note fields:", error);
            }
        },
        
        /**
         * Update incident with record URL
         */
        updateIncidentRecordUrl: async function(base) {
            try {
                const baseUrl = await ButtonBase.getKeyValuePair("base_url");
                
                if (!baseUrl) {
                    console.warn("Base URL not found in key value pairs");
                    return;
                }
                
                const recordUrl = `${baseUrl}/main.aspx?etn=incident&id=${base.state.request.id}&pagetype=entityrecord`;
                
                await ButtonBase.updateRecord("incident", base.state.request.id, {
                    vhacrm_recordurl_memo: recordUrl
                });
                
                console.log("Record URL updated");
            } catch (error) {
                console.error("Error updating record URL:", error);
            }
        },
        
        /**
         * Main execution for EED
         */
        execute: async function(base) {
            // Load EED-specific data
            this.loadFormData(base);
            
            // Load additional data in parallel
            await Promise.all([
                this.loadActivityCounts(base),
                this.checkCaseNoteExistsToday(base)
            ]);
            
            // Run validations
            const validationErrors = this.runValidations(base);
            
            if (validationErrors.length > 0) {
                base.showError(validationErrors.join(" | "));
                return;
            }
            
            // Create case note if memo is populated
            await this.createCaseNote(base);
            
            // Update incident case note fields
            await this.updateIncidentCaseNoteFields(base);
            
            // Update incident with record URL
            await this.updateIncidentRecordUrl(base);
            
            // Update HEC Alert if linked
            await base.updateHecAlert();
            
            // Save form first
            await ButtonBase.saveForm();
            
            // Execute complete workflow
            await ButtonBase.executeWorkflow(base.config.workflows.completeRequest, base.state.request.id);
            
            // Close form
            ButtonBase.closeForm();
        }
    };
    
    // Register with base module
    CompleteRequestButton.registerLOB("EED", EEDHandler);
})();
