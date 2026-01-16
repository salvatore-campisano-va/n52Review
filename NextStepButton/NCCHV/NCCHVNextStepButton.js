/**
 * NCCHV Next Step Button - Core Module
 * Handles validation and next action for NCCHV requests
 */
"use strict";

var NCCHVNextStepButton = NCCHVNextStepButton || {};

// ============================================================================
// Configuration
// ============================================================================

NCCHVNextStepButton.config = {
    // Case note type code
    caseNoteTypeCode: 168790000,
    
    // Action that requires Veteran Outcome validation (Consult Closure)
    consultClosureActionId: "17B9364F-7A17-E611-811E-127B25DCBDE7"
};

// ============================================================================
// State
// ============================================================================

NCCHVNextStepButton.state = {
    formContext: null,
    $button: null,
    currentUserId: null,
    
    request: {
        id: null,
        veteran: null,
        type: null,
        area: null,
        facility: null,
        action: null,
        caseNoteMemo: null,
        caseNoteTemplate: null,
        lob: null,
        subArea: null
    },
    
    caseNoteExists: false,
    veteranOutcomeExists: false,
    isConsultClosureAction: false
};

// ============================================================================
// Initialization
// ============================================================================

NCCHVNextStepButton.initialize = function() {
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
    
    console.log("NCCHV Next Step button initialized");
};

// ============================================================================
// UI Helper Functions
// ============================================================================

NCCHVNextStepButton.setButtonLoading = function(isLoading) {
    if (!this.$button) return;
    
    if (isLoading) {
        this.$button.classList.add("btn-loading");
        this.$button.querySelector(".button-text").textContent = "Processing...";
    } else {
        this.$button.classList.remove("btn-loading");
        this.$button.querySelector(".button-text").textContent = "Next Step";
    }
};

NCCHVNextStepButton.showAlert = async function(message, title = "Alert") {
    const xrm = this.getXrm();
    
    if (xrm.Navigation?.openAlertDialog) {
        return await xrm.Navigation.openAlertDialog({ text: message, title: title });
    }
    
    alert(message);
};

// ============================================================================
// Context Access Functions
// ============================================================================

NCCHVNextStepButton.getXrm = function() {
    if (parent.Xrm) return parent.Xrm;
    if (window.Xrm) return window.Xrm;
    throw new Error("Xrm is not available");
};

NCCHVNextStepButton.getFormContext = function() {
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

NCCHVNextStepButton.cleanGuid = function(guid) {
    if (!guid) return "";
    return guid.replace(/[{}]/g, "").toLowerCase();
};

NCCHVNextStepButton.getCurrentUserId = function() {
    if (this.state.currentUserId) return this.state.currentUserId;
    this.state.currentUserId = this.cleanGuid(
        this.getXrm().Utility.getGlobalContext().userSettings.userId
    );
    return this.state.currentUserId;
};

NCCHVNextStepButton.getLookupValue = function(attributeName) {
    const formContext = this.getFormContext();
    const attribute = formContext.getAttribute(attributeName);
    if (!attribute) return null;
    const value = attribute.getValue();
    if (!value || value.length === 0) return null;
    return value[0];
};

NCCHVNextStepButton.getAttributeValue = function(attributeName) {
    const formContext = this.getFormContext();
    const attribute = formContext.getAttribute(attributeName);
    return attribute ? attribute.getValue() : null;
};

// ============================================================================
// Data Loading
// ============================================================================

NCCHVNextStepButton.loadFormData = function() {
    const formContext = this.getFormContext();
    const state = this.state;
    
    state.request.id = this.cleanGuid(formContext.data.entity.getId());
    state.request.veteran = this.getLookupValue("customerid");
    state.request.type = this.getLookupValue("vhacrm_typeintersectionid");
    state.request.area = this.getLookupValue("vhacrm_areaintersectionid");
    state.request.facility = this.getLookupValue("vhacrm_facilityid");
    state.request.action = this.getLookupValue("vhacrm_actionintersectionid");
    state.request.caseNoteMemo = this.getAttributeValue("vhacrm_casenotes_memo");
    state.request.caseNoteTemplate = this.getLookupValue("vhacrm_casenotetemplateid");
    state.request.lob = this.getLookupValue("vhacrm_lobid");
    state.request.subArea = this.getLookupValue("vhacrm_subareaintersectionid");
    
    // Check if this is the Consult Closure action
    if (state.request.action) {
        const actionId = this.cleanGuid(state.request.action.id).toUpperCase();
        state.isConsultClosureAction = actionId === this.config.consultClosureActionId;
    }
};

NCCHVNextStepButton.checkCaseNoteExists = async function() {
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

NCCHVNextStepButton.checkVeteranOutcomeExists = async function() {
    if (!this.state.isConsultClosureAction) {
        this.state.veteranOutcomeExists = true; // Not required, so treat as satisfied
        return;
    }
    
    const requestId = this.state.request.id;
    
    try {
        const result = await this.getXrm().WebApi.retrieveMultipleRecords(
            "vhacrm_veteranoutcome",
            `?$select=vhacrm_veteranoutcomeid&$top=1&$filter=_vhacrm_requestid_value eq '${requestId}' and vhacrm_ispopulated_bool eq true`
        );
        this.state.veteranOutcomeExists = result.entities.length > 0;
    } catch (error) {
        console.error("Error checking veteran outcome existence:", error);
        this.state.veteranOutcomeExists = false;
    }
};

// ============================================================================
// Validation
// ============================================================================

NCCHVNextStepButton.isCurrentUserOwner = function() {
    const owner = this.getLookupValue("ownerid");
    if (!owner) return false;
    return this.cleanGuid(owner.id) === this.getCurrentUserId();
};

NCCHVNextStepButton.runValidations = function() {
    const errors = [];
    const state = this.state;
    
    if (!state.request.type) {
        errors.push("Type is required to resolve a Request.");
    }
    
    if (!state.request.area) {
        errors.push("Area is required to resolve a Request.");
    }
    
    if (!state.request.facility) {
        errors.push("Facility is required to resolve a Request.");
    }
    
    if (!state.request.veteran) {
        errors.push("Veteran is required to resolve a Request.");
    }
    
    // Veteran Outcome required for Consult Closure action
    if (state.isConsultClosureAction && !state.veteranOutcomeExists) {
        errors.push("At least one Veteran Outcome must be selected.");
    }
    
    if (!state.request.caseNoteMemo && !state.caseNoteExists) {
        errors.push("Please enter a Case Note before proceeding with action.");
    }
    
    return errors;
};

// ============================================================================
// Business Logic
// ============================================================================

NCCHVNextStepButton.buildCaseNoteName = function() {
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

NCCHVNextStepButton.createCaseNote = async function() {
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

NCCHVNextStepButton.saveAndClose = async function() {
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

NCCHVNextStepButton.execute = async function() {
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
    
    // Check for existing case notes and veteran outcomes in parallel
    await Promise.all([
        this.checkCaseNoteExists(),
        this.checkVeteranOutcomeExists()
    ]);
    
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
    NCCHVNextStepButton.initialize();
});