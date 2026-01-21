/**
 * Complete Request Button - HD Handler
 * LOB-specific logic for HD (Help Desk)
 */
"use strict";

(function() {
    var HDHandler = {
        name: "HD",
        
        // HD-specific configuration
        config: {
            // Case note type code
            caseNoteTypeCode: 168790000,
            
            // Workflow: Request - HD Route/Complete Request
            completeWorkflowId: "F9A56996-0EA6-4029-95C5-06A67315EED9",
            
            // HD LOB GUID
            hdLobId: "1bd4b15a-bfbb-e511-9414-0050568dc724"
        },
        
        // HD-specific state
        state: {
            type: null,
            area: null,
            subArea: null,
            caseNoteMemo: null,
            caseNoteTemplate: null,
            caseNoteExistsToday: false
        },
        
        /**
         * Load HD-specific form data
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
         * Run HD-specific validations
         */
        runValidations: function(base) {
            const errors = [];
            
            // Skip validations for Created in Error
            if (base.state.flags.isCreatedInError) {
                return errors;
            }
            
            // Case Note is required (memo OR existing today)
            if (!this.state.caseNoteMemo && !this.state.caseNoteExistsToday) {
                errors.push("A completed case note is required to complete the request.");
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
            
            const caseNote = {
                vhacrm_name: this.buildCaseNoteName(base),
                vhacrm_casenotes_memo: this.state.caseNoteMemo,
                "vhacrm_requestid@odata.bind": `/incidents(${base.state.request.id})`,
                vhacrm_casenotetype_code: this.config.caseNoteTypeCode
            };
            
            // Add veteran if present (HD uses customerid)
            if (base.state.request.veteran) {
                caseNote["vhacrm_veteranid@odata.bind"] = `/contacts(${ButtonBase.cleanGuid(base.state.request.veteran.id)})`;
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
         * Execute HD-specific workflow (only for HD LOB)
         */
        executeHDWorkflow: async function(base) {
            if (!base.state.request.lob) return;
            
            const lobId = ButtonBase.cleanGuid(base.state.request.lob.id);
            
            // Only execute HD workflow if LOB matches HD GUID
            if (lobId === this.config.hdLobId) {
                await ButtonBase.executeWorkflow(this.config.completeWorkflowId, base.state.request.id);
                console.log("HD workflow executed successfully");
            }
        },
        
        /**
         * Main execution for HD
         */
        execute: async function(base) {
            // Load HD-specific data
            this.loadFormData(base);
            
            // Check case note existence
            await this.checkCaseNoteExistsToday(base);
            
            // Run validations
            const validationErrors = this.runValidations(base);
            
            if (validationErrors.length > 0) {
                base.showError(validationErrors.join(" | "));
                return;
            }
            
            // Create case note if memo is populated
            await this.createCaseNote(base);
            
            // Save form first
            await ButtonBase.saveForm();
            
            // Execute HD workflow
            await this.executeHDWorkflow(base);
            
            // Close form
            ButtonBase.closeForm();
        }
    };
    
    // Register with base module
    CompleteRequestButton.registerLOB("HD", HDHandler);
})();
