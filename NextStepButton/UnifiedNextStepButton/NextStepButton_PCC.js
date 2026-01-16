/**
 * Next Step Button - PCC Handler
 * LOB-specific logic for PCC (Patient Care Center)
 */
"use strict";

(function() {
    var PCCHandler = {
        name: "PCC",
        
        // PCC-specific configuration
        config: {
            // PCC requires Facility Pharmacy
            requireFacilityPharmacy: true
        },
        
        // PCC-specific state
        state: {
            facilityPharmacy: null
        },
        
        /**
         * Load PCC-specific form data
         */
        loadFormData: function(base) {
            this.state.facilityPharmacy = ButtonBase.getLookupValue("vhacrm_facilitypharmacyid");
        },
        
        /**
         * Run PCC-specific validations
         */
        runValidations: function(base) {
            // Start with base validations
            const errors = base.runBaseValidations();
            
            // Facility Pharmacy is required for PCC
            if (!this.state.facilityPharmacy) {
                errors.push("Facility Pharmacy is required to process next step.");
            }
            
            return errors;
        },
        
        /**
         * Main execution for PCC
         */
        execute: async function(base) {
            // Load PCC-specific data
            this.loadFormData(base);
            
            // Check for existing case notes
            await base.checkCaseNoteExists();
            
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
            
            // Trigger workflow via boolean field
            base.triggerNextAction();
            
            // Save and close
            await ButtonBase.saveAndClose();
        }
    };
    
    // Register with base module
    NextStepButton.registerLOB("PCC", PCCHandler);
})();
