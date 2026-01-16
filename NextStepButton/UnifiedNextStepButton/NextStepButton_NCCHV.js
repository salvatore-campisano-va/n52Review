/**
 * Next Step Button - NCCHV Handler
 * LOB-specific logic for NCCHV (National Call Center for Homeless Veterans)
 */
"use strict";

(function() {
    var NCCHVHandler = {
        name: "NCCHV",
        
        // NCCHV-specific configuration
        config: {
            // Action that requires Veteran Outcome validation (Consult Closure)
            consultClosureActionId: "17b9364f-7a17-e611-811e-127b25dcbde7"
        },
        
        // NCCHV-specific state
        state: {
            isConsultClosureAction: false,
            veteranOutcomeExists: false
        },
        
        /**
         * Load NCCHV-specific form data
         */
        loadFormData: function(base) {
            // Check if this is the Consult Closure action
            if (base.state.request.action) {
                const actionId = ButtonBase.cleanGuid(base.state.request.action.id);
                this.state.isConsultClosureAction = actionId === this.config.consultClosureActionId;
            } else {
                this.state.isConsultClosureAction = false;
            }
        },
        
        /**
         * Check if veteran outcome exists for Consult Closure action
         */
        checkVeteranOutcomeExists: async function(base) {
            if (!this.state.isConsultClosureAction) {
                this.state.veteranOutcomeExists = true; // Not required, so treat as satisfied
                return;
            }
            
            const requestId = base.state.request.id;
            
            try {
                const result = await ButtonBase.retrieveMultipleRecords(
                    "vhacrm_veteranoutcome",
                    `?$select=vhacrm_veteranoutcomeid&$top=1&$filter=_vhacrm_requestid_value eq '${requestId}' and vhacrm_ispopulated_bool eq true`
                );
                this.state.veteranOutcomeExists = result.entities.length > 0;
            } catch (error) {
                console.error("Error checking veteran outcome existence:", error);
                this.state.veteranOutcomeExists = false;
            }
        },
        
        /**
         * Run NCCHV-specific validations
         */
        runValidations: function(base) {
            // Start with base validations (but customize messages)
            const errors = [];
            const state = base.state;
            
            // Type is required
            if (!state.request.type) {
                errors.push("Type is required to resolve a Request.");
            }
            
            // Area is required
            if (!state.request.area) {
                errors.push("Area is required to resolve a Request.");
            }
            
            // Facility is required
            if (!state.request.facility) {
                errors.push("Facility is required to resolve a Request.");
            }
            
            // Veteran is required
            if (!state.request.veteran) {
                errors.push("Veteran is required to resolve a Request.");
            }
            
            // Veteran Outcome required for Consult Closure action
            if (this.state.isConsultClosureAction && !this.state.veteranOutcomeExists) {
                errors.push("At least one Veteran Outcome must be selected.");
            }
            
            // Case Note is required (memo OR existing)
            if (!state.request.caseNoteMemo && !state.flags.caseNoteExists) {
                errors.push("Please enter a Case Note before proceeding with action.");
            }
            
            return errors;
        },
        
        /**
         * Main execution for NCCHV
         */
        execute: async function(base) {
            // Load NCCHV-specific data
            this.loadFormData(base);
            
            // Check for existing case notes and veteran outcomes in parallel
            await Promise.all([
                base.checkCaseNoteExists(),
                this.checkVeteranOutcomeExists(base)
            ]);
            
            // Run validations
            const validationErrors = this.runValidations(base);
            
            if (validationErrors.length > 0) {
                const errorMessage = "Please correct the following:\n• " + validationErrors.join("\n• ");
                await ButtonBase.showAlert(errorMessage, "Validation Errors");
                return;
            }
            
            // All validations passed - proceed with actions
            
            // Create case note if memo is populated
            await base.createCaseNote();
            
            // Save and close (NCCHV doesn't use the trigger boolean)
            await ButtonBase.saveAndClose();
        }
    };
    
    // Register with base module
    NextStepButton.registerLOB("NCCHV", NCCHVHandler);
})();
