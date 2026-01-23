/**
 * PCC Complete Request Button - Core Module
 * Handles validation and completion for PCC (Patient Care Coordination) requests
 */
"use strict";

var CompleteRequest_PCC = CompleteRequest_PCC || {};

// ============================================================================
// Configuration
// ============================================================================

CompleteRequest_PCC.config = {
    // Case note type code
    caseNoteTypeCode: 168790000,
    
    // Team names for facility pharmacy check
    facilityPharmacyTeams: [
        "PCC Facility Pharmacy",
        "PCC Facility Pharmacy Tech"
    ],
    
    // Closure reason IDs that require a case note
    closureReasonsRequiringCaseNote: [
        "75c52ebd-d102-e811-9487-0050568dd32b",
        "4094d1d3-d102-e811-9487-0050568dd32b"
    ]
};

// ============================================================================
// State
// ============================================================================

CompleteRequest_PCC.state = {
    formContext: null,
    $button: null,
    currentUserId: null,
    
    request: {
        id: null,
        veteran: null,
        type: null,
        area: null,
        subArea: null,
        facility: null,
        pharmacy: null,
        resolution: null,
        caseNoteMemo: null,
        caseNoteTemplate: null,
        lob: null
    },
    
    // Validation state
    caseNoteExistsToday: false,
    closureReasonCount: 0,
    closureReasonTypeCount: 0,
    userHasFacilityTeam: false
};

// ============================================================================
// Initialization
// ============================================================================

CompleteRequest_PCC.initialize = function() {
    const self = this;
    
    this.$button = document.getElementById("CompleteRequest");
    
    if (!this.$button) {
        console.error("CompleteRequest button not found");
        return;
    }
    
    this.$button.addEventListener("click", async function() {
        if (self.$button.disabled) return;
        
        try {
            self.setButtonLoading(true);
            await self.execute();
        } catch (error) {
            console.error("Error in CompleteRequest:", error);
            self.showAlert("An unexpected error occurred. Please try again.");
        } finally {
            self.setButtonLoading(false);
        }
    });
    
    console.log("PCC Complete Request button initialized");
};

// ============================================================================
// UI Helper Functions
// ============================================================================

CompleteRequest_PCC.setButtonLoading = function(isLoading) {
    if (!this.$button) return;
    
    const spinner = this.$button.querySelector(".spinner-border");
    
    if (isLoading) {
        this.$button.disabled = true;
        this.$button.querySelector(".button-text").textContent = "Processing...";
        if (spinner) spinner.classList.remove("d-none");
    } else {
        this.$button.disabled = false;
        this.$button.querySelector(".button-text").textContent = "Complete Request";
        if (spinner) spinner.classList.add("d-none");
    }
};

CompleteRequest_PCC.showError = function(message) {
    const formContext = this.getFormContext();
    formContext.ui.clearFormNotification("PCC_ERROR");
    formContext.ui.setFormNotification(message, "ERROR", "PCC_ERROR");
};

CompleteRequest_PCC.clearError = function() {
    const formContext = this.getFormContext();
    formContext.ui.clearFormNotification("PCC_ERROR");
};

CompleteRequest_PCC.showAlert = async function(message, title = "Alert") {
    const xrm = this.getXrm();
    
    if (xrm.Navigation?.openAlertDialog) {
        return await xrm.Navigation.openAlertDialog({ text: message, title: title });
    }
    
    alert(message);
};

// ============================================================================
// Context Access Functions
// ============================================================================

CompleteRequest_PCC.getXrm = function() {
    if (parent.Xrm) return parent.Xrm;
    if (window.Xrm) return window.Xrm;
    throw new Error("Xrm is not available");
};

CompleteRequest_PCC.getFormContext = function() {
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

CompleteRequest_PCC.cleanGuid = function(guid) {
    if (!guid) return "";
    return guid.replace(/[{}]/g, "").toLowerCase();
};

CompleteRequest_PCC.getCurrentUserId = function() {
    if (this.state.currentUserId) return this.state.currentUserId;
    this.state.currentUserId = this.cleanGuid(
        this.getXrm().Utility.getGlobalContext().userSettings.userId
    );
    return this.state.currentUserId;
};

CompleteRequest_PCC.getLookupValue = function(attributeName) {
    const formContext = this.getFormContext();
    const attribute = formContext.getAttribute(attributeName);
    if (!attribute) return null;
    const value = attribute.getValue();
    if (!value || value.length === 0) return null;
    return value[0];
};

CompleteRequest_PCC.getAttributeValue = function(attributeName) {
    const formContext = this.getFormContext();
    const attribute = formContext.getAttribute(attributeName);
    return attribute ? attribute.getValue() : null;
};

// ============================================================================
// Data Loading
// ============================================================================

CompleteRequest_PCC.loadFormData = function() {
    const formContext = this.getFormContext();
    const state = this.state;
    
    state.request.id = this.cleanGuid(formContext.data.entity.getId());
    state.request.veteran = this.getLookupValue("customerid");
    state.request.type = this.getLookupValue("vhacrm_typeintersectionid");
    state.request.area = this.getLookupValue("vhacrm_areaintersectionid");
    state.request.subArea = this.getLookupValue("vhacrm_subareaintersectionid");
    state.request.facility = this.getLookupValue("vhacrm_facilityid");
    state.request.pharmacy = this.getLookupValue("vhacrm_facilitypharmacyid");
    state.request.resolution = this.getLookupValue("vhacrm_resolutionintersectionid");
    state.request.caseNoteMemo = this.getAttributeValue("vhacrm_casenotes_memo");
    state.request.caseNoteTemplate = this.getLookupValue("vhacrm_casenotetemplateid");
    state.request.lob = this.getLookupValue("vhacrm_lobid");
};

CompleteRequest_PCC.checkCaseNoteExistsToday = async function() {
    const requestId = this.state.request.id;
    const ownerId = this.getCurrentUserId();
    
    // Get today's date range (UTC)
    const today = new Date();
    const startOfDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0));
    const endOfDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59));
    
    try {
        // Check for case notes: same request, created by owner, created today, NOT linked to an interaction
        const result = await this.getXrm().WebApi.retrieveMultipleRecords(
            "vhacrm_casenote",
            `?$select=vhacrm_casenoteid&$top=1&$filter=_vhacrm_requestid_value eq '${requestId}' and _createdby_value eq '${ownerId}' and createdon ge ${startOfDay.toISOString()} and createdon le ${endOfDay.toISOString()} and vhacrm_interactionid eq null`
        );
        this.state.caseNoteExistsToday = result.entities.length > 0;
    } catch (error) {
        console.error("Error checking case note existence:", error);
        this.state.caseNoteExistsToday = false;
    }
};

CompleteRequest_PCC.checkClosureReasonCount = async function() {
    const requestId = this.state.request.id;
    
    try {
        // Query from incident and expand the related facility responses (closure reasons) via M:N relationship
        const result = await this.getXrm().WebApi.retrieveRecord(
            "incident",
            requestId,
            "?$expand=vhacrm_vhacrm_facilityresponse_incident($select=vhacrm_facilityresponseid)"
        );
        
        const closureReasons = result.vhacrm_vhacrm_facilityresponse_incident || [];
        this.state.closureReasonCount = closureReasons.length;
    } catch (error) {
        console.error("Error checking closure reason count:", error);
        this.state.closureReasonCount = 0;
    }
};

CompleteRequest_PCC.checkClosureReasonTypeCount = async function() {
    const requestId = this.state.request.id;
    
    try {
        // Query closure reasons linked to this request
        const result = await this.getXrm().WebApi.retrieveRecord(
            "incident",
            requestId,
            "?$expand=vhacrm_vhacrm_facilityresponse_incident($select=vhacrm_facilityresponseid)"
        );
        
        const closureReasons = result.vhacrm_vhacrm_facilityresponse_incident || [];
        
        // Filter to only those that require a case note (specific IDs from config)
        const requiresCaseNote = closureReasons.filter(cr => 
            this.config.closureReasonsRequiringCaseNote.includes(cr.vhacrm_facilityresponseid.toLowerCase())
        );
        this.state.closureReasonTypeCount = requiresCaseNote.length;
    } catch (error) {
        console.error("Error checking closure reason type count:", error);
        this.state.closureReasonTypeCount = 0;
    }
};

CompleteRequest_PCC.checkUserTeamMembership = async function() {
    const userId = this.getCurrentUserId();
    
    try {
        // Get user's team memberships
        const result = await this.getXrm().WebApi.retrieveMultipleRecords(
            "teammembership",
            `?$select=teamid&$filter=systemuserid eq '${userId}'`
        );
        
        if (result.entities.length === 0) {
            this.state.userHasFacilityTeam = false;
            return;
        }
        
        // Get team IDs
        const teamIds = result.entities.map(tm => tm.teamid);
        
        // Check if any of the user's teams match the facility pharmacy teams
        const teamFilter = teamIds.map(id => `teamid eq '${id}'`).join(" or ");
        const nameFilter = this.config.facilityPharmacyTeams.map(name => `name eq '${name}'`).join(" or ");
        
        const teamsResult = await this.getXrm().WebApi.retrieveMultipleRecords(
            "team",
            `?$select=teamid,name&$filter=(${teamFilter}) and (${nameFilter})`
        );
        
        this.state.userHasFacilityTeam = teamsResult.entities.length > 0;
    } catch (error) {
        console.error("Error checking user team membership:", error);
        this.state.userHasFacilityTeam = false;
    }
};

// ============================================================================
// Validation
// ============================================================================

CompleteRequest_PCC.isCurrentUserOwner = function() {
    const owner = this.getLookupValue("ownerid");
    if (!owner) return false;
    return this.cleanGuid(owner.id) === this.getCurrentUserId();
};

CompleteRequest_PCC.runValidations = function() {
    const errors = [];
    const state = this.state;
    
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
    
    // Pharmacy is required
    if (!state.request.pharmacy) {
        errors.push("Pharmacy is required to resolve a Request.");
    }
    
    // Veteran is required
    if (!state.request.veteran) {
        errors.push("Veteran is required to resolve a Request.");
    }
    
    // Closure Reason is required if user has facility team and no closure reasons exist
    if (state.userHasFacilityTeam && state.closureReasonCount === 0) {
        errors.push("Closure Reason is required to resolve a Request.");
    }
    
    // Case Note is required if closure reason type requires it and no case note exists
    if (state.closureReasonTypeCount > 0 && !state.caseNoteExistsToday && !state.request.caseNoteMemo) {
        errors.push("Case Note is required to resolve a Request.");
    }
    
    return errors;
};

// ============================================================================
// Business Logic
// ============================================================================

CompleteRequest_PCC.buildCaseNoteName = function() {
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

CompleteRequest_PCC.createCaseNote = async function() {
    if (!this.state.request.caseNoteMemo) return;
    
    const caseNote = {
        vhacrm_name: this.buildCaseNoteName(),
        vhacrm_casenotes_memo: this.state.request.caseNoteMemo,
        "vhacrm_requestid@odata.bind": `/incidents(${this.state.request.id})`,
        vhacrm_casenotetype_code: this.config.caseNoteTypeCode
    };
    
    // Add veteran if present
    if (this.state.request.veteran) {
        caseNote["vhacrm_veteranid@odata.bind"] = `/contacts(${this.cleanGuid(this.state.request.veteran.id)})`;
    }
    
    // Add template if present
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

CompleteRequest_PCC.saveAndClose = async function() {
    try {
        await this.getFormContext().data.save();
        this.closeForm();
    } catch (error) {
        console.error("Error saving record:", error);
        throw new Error("Failed to save the record.");
    }
};

CompleteRequest_PCC.closeForm = function() {
    const xrm = this.getXrm();
    if (xrm.Navigation?.navigateBack) {
        xrm.Navigation.navigateBack();
    } else {
        this.getFormContext().ui.close();
    }
};

// ============================================================================
// Main Execution Flow
// ============================================================================

CompleteRequest_PCC.execute = async function() {
    this.clearError();
    
    // Pre-validation: Resolution required
    if (!this.getLookupValue("vhacrm_resolutionintersectionid")) {
        this.showError("A Resolution must be provided before completing the request.");
        return;
    }
    
    // Pre-validation: Owner check
    if (!this.isCurrentUserOwner()) {
        this.showError("You must pick the request from the queue before completing the request.");
        return;
    }
    
    // Load form data
    this.loadFormData();
    
    // Load additional data for validation (in parallel)
    await Promise.all([
        this.checkCaseNoteExistsToday(),
        this.checkClosureReasonCount(),
        this.checkClosureReasonTypeCount(),
        this.checkUserTeamMembership()
    ]);
    
    // Run validations
    const validationErrors = this.runValidations();
    
    if (validationErrors.length > 0) {
        this.showError(validationErrors.join(" | "));
        return;
    }
    
    // All validations passed - proceed with completion
    try {
        // Create case note if memo is populated
        await this.createCaseNote();
        
        // Trigger the workflow by setting the flag field
        this.triggerCompleteWorkflow();
        
        // Save and close form
        await this.saveAndClose();
        
    } catch (error) {
        console.error("Error completing request:", error);
        this.showError(error.message || "An error occurred while completing the request.");
    }
};

// ============================================================================
// Auto-initialize when DOM is ready
// ============================================================================

document.addEventListener("DOMContentLoaded", function() {
    CompleteRequest_PCC.initialize();
});
