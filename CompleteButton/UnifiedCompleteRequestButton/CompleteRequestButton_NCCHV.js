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
            if (!base.state.request.resolution) return;
            
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
                hecAlert: base.state.request.hecAlert,
                caseNoteTemplate: this.state.caseNoteTemplate
            });
        },
        
        /**
         * Update incident case note fields
         */
        updateIncidentCaseNoteFields: async function(base) {
            await CompleteRequestButton.updateIncidentCaseNoteFields(
                base.state.request.id,
                this.state.caseNoteMemo
            );
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
