/**
 * Complete Request Button - NCCHV Handler
 * LOB-specific logic for NCCHV (National Call Center for Homeless Veterans)
 */
"use strict";

(function() {
    var NCCHVHandler = {
        name: "NCCHV",
        
        // NCCHV-specific configuration
        config: {
            // Workflow: NCCHV specific complete workflow
            completeWorkflowId: "381d264d-ac3d-43b0-ba95-2ba2cb2a5506",
            
            // Case note type code
            caseNoteTypeCode: 168790000
        },
        
        // NCCHV-specific state
        state: {
            type: null,
            area: null,
            subArea: null,
            caseNoteMemo: null,
            caseNoteTemplate: null,
            caseNoteExistsToday: false
        },
        
        /**
         * Load NCCHV-specific form data
         */
        loadFormData: function(base) {
            this.state.type = ButtonBase.getLookupValue("vhacrm_typeintersectionid");
            this.state.area = ButtonBase.getLookupValue("vhacrm_areaintersectionid");
            this.state.subArea = ButtonBase.getLookupValue("vhacrm_subareaintersectionid");
            this.state.caseNoteMemo = ButtonBase.getAttributeValue("vhacrm_casenotes_memo");
            this.state.caseNoteTemplate = ButtonBase.getLookupValue("vhacrm_casenotetemplateid");
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
         * Run NCCHV-specific validations
         */
        runValidations: function(base) {
            // Start with base validations
            const errors = base.runBaseValidations();
            
            // Skip additional validations for Created in Error
            if (base.state.flags.isCreatedInError) {
                return errors;
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
         * Main execution for NCCHV
         */
        execute: async function(base) {
            // Load NCCHV-specific data
            this.loadFormData(base);
            await this.checkCaseNoteExistsToday(base);
            
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
            
            // Update HEC Alert if linked
            await base.updateHecAlert();
            
            // Save form first
            await ButtonBase.saveForm();
            
            // Execute NCCHV complete workflow
            await ButtonBase.executeWorkflow(this.config.completeWorkflowId, base.state.request.id);
            
            // Close form
            ButtonBase.closeForm();
        }
    };
    
    // Register with base module
    CompleteRequestButton.registerLOB("NCCHV", NCCHVHandler);
})();
