/**
 * PCC Next Step Button - Core Module
 * Handles validation and next action for PCC requests
 */
"use strict";

var PCCNextStepButton = PCCNextStepButton || {};

// ============================================================================
// Configuration
// ============================================================================

PCCNextStepButton.config = {
    // Case note type code
    caseNoteTypeCode: 168790000
};

// ============================================================================
// State
// ============================================================================

PCCNextStepButton.state = {
    formContext: null,
    $button: null,
    currentUserId: null,
    
    request: {
        id: null,
        veteran: null,
        type: null,
        area: null,
        facility: null,
        facilityPharmacy: null,
        action: null,
        caseNoteMemo: null,
        caseNoteTemplate: null,
        lob: null,
        subArea: null
    },
    
    caseNoteExists: false
};

// ============================================================================
// Initialization
// ============================================================================

PCCNextStepButton.initialize = function() {
    const self = this;
    
    this.$button = document.getElementById("NextStep");
    
    if (!this.$button) {
        console.error("NextStep button not found");
        return;
    }
    
    this.$button.addEventListener("click", async function() {
        if (self.$button.classList.contains("btn-loading")) return;
        
        try {
            self.setButtonLoading(true);
            await self.execute();
        } catch (error) {
            console.error("Error in NextStep:", error);
            self.showAlert("An unexpected error occurred. Please try again.");
        } finally {
            self.setButtonLoading(false);
        }
    });
    
    console.log("PCC Next Step button initialized");
};

// ============================================================================
// UI Helper Functions
// ============================================================================

PCCNextStepButton.setButtonLoading = function(isLoading) {
    if (!this.$button) return;
    
    if (isLoading) {
        this.$button.classList.add("btn-loading");
        this.$button.querySelector(".button-text").textContent = "Processing...";
    } else {
        this.$button.classList.remove("btn-loading");
        this.$button.querySelector(".button-text").textContent = "Next Step";
    }
};

PCCNextStepButton.showAlert = async function(message, title = "Alert") {
    const xrm = this.getXrm();
    
    if (xrm.Navigation?.openAlertDialog) {
        return await xrm.Navigation.openAlertDialog({ text: message, title: title });
    }
    
    alert(message);
};

// ============================================================================
// Context Access Functions
// ============================================================================

PCCNextStepButton.getXrm = function() {
    if (parent.Xrm) return parent.Xrm;
    if (window.Xrm) return window.Xrm;
    throw new Error("Xrm is not available");
};

PCCNextStepButton.getFormContext = function() {
    if (this.state.formContext) return this.state.formContext;
    
    if (parent.formContext) {
        this.state.formContext = parent.formContext;
        return this.state.formContext;
    }
    
    if (parent.Xrm?.Page?.data) {
        this.state.formContext = parent.Xrm.Page;
        return this.state.formContext;
    }
    
    throw new Error("Form context not available");
};

// ============================================================================
// Utility Functions
// ============================================================================

PCCNextStepButton.cleanGuid = function(guid) {
    if (!guid) return "";
    return guid.replace(/[{}]/g, "").toLowerCase();
};

PCCNextStepButton.getCurrentUserId = function() {
    if (this.state.currentUserId) return this.state.currentUserId;
    this.state.currentUserId = this.cleanGuid(
        this.getXrm().Utility.getGlobalContext().userSettings.userId
    );
    return this.state.currentUserId;
};

PCCNextStepButton.getLookupValue = function(attributeName) {
    const formContext = this.getFormContext();
    const attribute = formContext.getAttribute(attributeName);
    if (!attribute) return null;
    const value = attribute.getValue();
    if (!value || value.length === 0) return null;
    return value[0];
};

PCCNextStepButton.getAttributeValue = function(attributeName) {
    const formContext = this.getFormContext();
    const attribute = formContext.getAttribute(attributeName);
    return attribute ? attribute.getValue() : null;
};

// ============================================================================
// Data Loading
// ============================================================================

PCCNextStepButton.loadFormData = function() {
    const formContext = this.getFormContext();
    const state = this.state;
    
    state.request.id = this.cleanGuid(formContext.data.entity.getId());
    state.request.veteran = this.getLookupValue("customerid");
    state.request.type = this.getLookupValue("vhacrm_typeintersectionid");
    state.request.area = this.getLookupValue("vhacrm_areaintersectionid");
    state.request.facility = this.getLookupValue("vhacrm_facilityid");
    state.request.facilityPharmacy = this.getLookupValue("vhacrm_facilitypharmacyid");
    state.request.action = this.getLookupValue("vhacrm_actionintersectionid");
    state.request.caseNoteMemo = this.getAttributeValue("vhacrm_casenotes_memo");
    state.request.caseNoteTemplate = this.getLookupValue("vhacrm_casenotetemplateid");
    state.request.lob = this.getLookupValue("vhacrm_lobid");
    state.request.subArea = this.getLookupValue("vhacrm_subareaintersectionid");
};

PCCNextStepButton.checkCaseNoteExists = async function() {
    const requestId = this.state.request.id;
    const ownerId = this.getCurrentUserId();
    
    try {
        const result = await this.getXrm().WebApi.retrieveMultipleRecords(
            "vhacrm_casenote",
            `?$select=vhacrm_name&$top=1&$filter=_vhacrm_requestid_value eq '${requestId}' and _createdby_value eq '${ownerId}'`
        );
        this.state.caseNoteExists = result.entities.length > 0;
    } catch (error) {
        console.error("Error checking case note existence:", error);
        this.state.caseNoteExists = false;
    }
};

// ============================================================================
// Validation
// ============================================================================

PCCNextStepButton.isCurrentUserOwner = function() {
    const owner = this.getLookupValue("ownerid");
    if (!owner) return false;
    return this.cleanGuid(owner.id) === this.getCurrentUserId();
};

PCCNextStepButton.runValidations = function() {
    const errors = [];
    const state = this.state;
    
    if (!state.request.type) {
        errors.push("Type is required to process next step.");
    }
    
    if (!state.request.area) {
        errors.push("Area is required to process next step.");
    }
    
    if (!state.request.facility) {
        errors.push("Facility is required to process next step.");
    }
    
    if (!state.request.facilityPharmacy) {
        errors.push("Facility Pharmacy is required to process next step.");
    }
    
    if (!state.request.veteran) {
        errors.push("Veteran is required to process next step.");
    }
    
    if (!state.request.caseNoteMemo && !state.caseNoteExists) {
        errors.push("Please enter a Case Note before proceeding with action.");
    }
    
    return errors;
};

// ============================================================================
// Business Logic
// ============================================================================

PCCNextStepButton.buildCaseNoteName = function() {
    const state = this.state;
    let name = "";
    
    if (state.request.lob) {
        name = state.request.lob.name;
    }
    
    if (state.request.type) {
        name += (name ? "/" : "") + state.request.type.name;
    }
    
    if (state.request.area) {
        name += (name ? "/" : "") + state.request.area.name;
    }
    
    if (state.request.subArea) {
        name += (name ? "/" : "") + state.request.subArea.name;
    }
    
    return name;
};

PCCNextStepButton.createCaseNote = async function() {
    if (!this.state.request.caseNoteMemo) return;
    if (!this.state.request.veteran) return;
    
    const caseNote = {
        vhacrm_name: this.buildCaseNoteName(),
        vhacrm_casenotes_memo: this.state.request.caseNoteMemo,
        "vhacrm_requestid@odata.bind": `/incidents(${this.state.request.id})`,
        "vhacrm_veteranid@odata.bind": `/contacts(${this.cleanGuid(this.state.request.veteran.id)})`,
        vhacrm_casenotetype_code: this.config.caseNoteTypeCode
    };
    
    if (this.state.request.caseNoteTemplate) {
        caseNote["vhacrm_casenotetemplateid@odata.bind"] = 
            `/vhacrm_casenotetemplates(${this.cleanGuid(this.state.request.caseNoteTemplate.id)})`;
    }
    
    try {
        await this.getXrm().WebApi.createRecord("vhacrm_casenote", caseNote);
        console.log("Case note created successfully");
    } catch (error) {
        console.error("Error creating case note:", error);
        throw new Error("Failed to create case note.");
    }
};

PCCNextStepButton.triggerNextAction = function() {
    const formContext = this.getFormContext();
    const attribute = formContext.getAttribute("vhacrm_onpccnextactionbutton");
    if (attribute) {
        attribute.setValue(true);
    }
};

PCCNextStepButton.saveAndClose = async function() {
    const formContext = this.getFormContext();
    
    try {
        await formContext.data.save();
        
        const xrm = this.getXrm();
        if (xrm.Navigation?.navigateBack) {
            xrm.Navigation.navigateBack();
        } else {
            formContext.ui.close();
        }
    } catch (error) {
        console.error("Error saving record:", error);
        throw new Error("Failed to save the record.");
    }
};

// ============================================================================
// Main Execution Flow
// ============================================================================

PCCNextStepButton.execute = async function() {
    // Pre-validation: Action required
    if (!this.getLookupValue("vhacrm_actionintersectionid")) {
        await this.showAlert("Please select an Action before continuing.", "Missing Action");
        return;
    }
    
    // Pre-validation: Owner check
    if (!this.isCurrentUserOwner()) {
        await this.showAlert("You must pick the request from the queue before proceeding.", "Incorrect Request Owner");
        return;
    }
    
    // Load form data
    this.loadFormData();
    
    // Check for existing case notes
    await this.checkCaseNoteExists();
    
    // Run validations
    const validationErrors = this.runValidations();
    
    if (validationErrors.length > 0) {
        const errorMessage = "Please correct the following:\n• " + validationErrors.join("\n• ");
        await this.showAlert(errorMessage, "Validation Errors");
        return;
    }
    
    // All validations passed - proceed with actions
    try {
        // Create case note if memo is populated
        await this.createCaseNote();
        
        // Trigger workflow via boolean field
        this.triggerNextAction();
        
        // Save and close
        await this.saveAndClose();
        
    } catch (error) {
        console.error("Error completing next step:", error);
        await this.showAlert(error.message || "An error occurred. Please try again.");
    }
};

// ============================================================================
// Auto-initialize when DOM is ready
// ============================================================================

document.addEventListener("DOMContentLoaded", function() {
    PCCNextStepButton.initialize();
});