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
            // Use shared utility for common form fields
            const commonFields = CompleteRequestButton.loadCommonFormFields();
            this.state.type = commonFields.type;
            this.state.area = commonFields.area;
            this.state.subArea = commonFields.subArea;
            this.state.caseNoteMemo = commonFields.caseNoteMemo;
            this.state.caseNoteTemplate = commonFields.caseNoteTemplate;
        },
        
        /**
         * Check if case note exists today by current user
         */
        checkCaseNoteExistsToday: async function(base) {
            this.state.caseNoteExistsToday = await CompleteRequestButton.checkCaseNoteExistsToday(base.state.request.id);
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
            const caseNoteError = CompleteRequestButton.validateCaseNoteRequired(
                this.state.caseNoteMemo,
                this.state.caseNoteExistsToday
            );
            if (caseNoteError) {
                errors.push(caseNoteError);
            }
            
            return errors;
        },
        
        /**
         * Create case note record
         */
        createCaseNote: async function(base) {
            if (!this.state.caseNoteMemo) return;
            
            await CompleteRequestButton.createCaseNote({
                requestId: base.state.request.id,
                caseNoteName: CompleteRequestButton.buildCaseNoteName(
                    base.state.request.lob,
                    this.state.type,
                    this.state.area,
                    this.state.subArea
                ),
                caseNoteMemo: this.state.caseNoteMemo,
                caseNoteTypeCode: this.config.caseNoteTypeCode,
                veteran: base.state.request.veteran,
                caseNoteTemplate: this.state.caseNoteTemplate
                // Note: HD does not include hecAlert in case notes
            });
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
