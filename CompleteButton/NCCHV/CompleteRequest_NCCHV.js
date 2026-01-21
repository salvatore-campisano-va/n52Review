/**
 * NCCHV Complete Request Button - Core Module
 * Handles validation and completion for NCCHV requests
 */
"use strict";

var CompleteRequest_NCCHV = CompleteRequest_NCCHV || {};

// ============================================================================
// Configuration
// ============================================================================

CompleteRequest_NCCHV.config = {
    // Case note type code
    caseNoteTypeCode: 168790000,
    
    // Workflow: Request - NCCHV Route/Complete Request
    completeWorkflowId: "381d264d-ac3d-43b0-ba95-2ba2cb2a5506"
};

// ============================================================================
// State
// ============================================================================

CompleteRequest_NCCHV.state = {
    formContext: null,
    $button: null,
    currentUserId: null,
    
    request: {
        id: null,
        veteran: null,
        type: null,
        area: null,
        facility: null,
        resolution: null,
        veteranOutcome: null,
        caseNoteMemo: null,
        caseNoteTemplate: null,
        lob: null,
        subArea: null,
        daysAtAssignment: null
    },
    
    caseNoteExistsToday: false
};

// ============================================================================
// Initialization
// ============================================================================

CompleteRequest_NCCHV.initialize = function() {
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
    
    console.log("NCCHV Complete Request button initialized");
};

// ============================================================================
// UI Helper Functions
// ============================================================================

CompleteRequest_NCCHV.setButtonLoading = function(isLoading) {
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

CompleteRequest_NCCHV.showError = function(message) {
    const formContext = this.getFormContext();
    formContext.ui.clearFormNotification("NCCHV_ERROR");
    formContext.ui.setFormNotification(message, "ERROR", "NCCHV_ERROR");
};

CompleteRequest_NCCHV.clearError = function() {
    const formContext = this.getFormContext();
    formContext.ui.clearFormNotification("NCCHV_ERROR");
};

CompleteRequest_NCCHV.showAlert = async function(message, title = "Alert") {
    const xrm = this.getXrm();
    
    if (xrm.Navigation?.openAlertDialog) {
        return await xrm.Navigation.openAlertDialog({ text: message, title: title });
    }
    
    alert(message);
};

// ============================================================================
// Context Access Functions
// ============================================================================

CompleteRequest_NCCHV.getXrm = function() {
    if (parent.Xrm) return parent.Xrm;
    if (window.Xrm) return window.Xrm;
    throw new Error("Xrm is not available");
};

CompleteRequest_NCCHV.getFormContext = function() {
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

CompleteRequest_NCCHV.cleanGuid = function(guid) {
    if (!guid) return "";
    return guid.replace(/[{}]/g, "").toLowerCase();
};

CompleteRequest_NCCHV.getCurrentUserId = function() {
    if (this.state.currentUserId) return this.state.currentUserId;
    this.state.currentUserId = this.cleanGuid(
        this.getXrm().Utility.getGlobalContext().userSettings.userId
    );
    return this.state.currentUserId;
};

CompleteRequest_NCCHV.getLookupValue = function(attributeName) {
    const formContext = this.getFormContext();
    const attribute = formContext.getAttribute(attributeName);
    if (!attribute) return null;
    const value = attribute.getValue();
    if (!value || value.length === 0) return null;
    return value[0];
};

CompleteRequest_NCCHV.getAttributeValue = function(attributeName) {
    const formContext = this.getFormContext();
    const attribute = formContext.getAttribute(attributeName);
    return attribute ? attribute.getValue() : null;
};

// ============================================================================
// Data Loading
// ============================================================================

CompleteRequest_NCCHV.loadFormData = function() {
    const formContext = this.getFormContext();
    const state = this.state;
    
    state.request.id = this.cleanGuid(formContext.data.entity.getId());
    state.request.veteran = this.getLookupValue("customerid");
    state.request.type = this.getLookupValue("vhacrm_typeintersectionid");
    state.request.area = this.getLookupValue("vhacrm_areaintersectionid");
    state.request.facility = this.getLookupValue("vhacrm_facilityid");
    state.request.resolution = this.getLookupValue("vhacrm_resolutionintersectionid");
    state.request.veteranOutcome = this.getLookupValue("vhacrm_veteranoutcomeid");
    state.request.caseNoteMemo = this.getAttributeValue("vhacrm_casenotes_memo");
    state.request.caseNoteTemplate = this.getLookupValue("vhacrm_casenotetemplateid");
    state.request.lob = this.getLookupValue("vhacrm_lobid");
    state.request.subArea = this.getLookupValue("vhacrm_subareaintersectionid");
    state.request.daysAtAssignment = this.getAttributeValue("vhacrm_daysatassignment_number");
};

CompleteRequest_NCCHV.checkCaseNoteExistsToday = async function() {
    const requestId = this.state.request.id;
    const ownerId = this.getCurrentUserId();
    
    // Get today's date range (UTC)
    const today = new Date();
    const startOfDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0));
    const endOfDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59));
    
    try {
        const result = await this.getXrm().WebApi.retrieveMultipleRecords(
            "vhacrm_casenote",
            `?$select=vhacrm_casenoteid&$top=1&$filter=_vhacrm_requestid_value eq '${requestId}' and _createdby_value eq '${ownerId}' and createdon ge ${startOfDay.toISOString()} and createdon le ${endOfDay.toISOString()}`
        );
        this.state.caseNoteExistsToday = result.entities.length > 0;
    } catch (error) {
        console.error("Error checking case note existence:", error);
        this.state.caseNoteExistsToday = false;
    }
};

// ============================================================================
// Validation
// ============================================================================

CompleteRequest_NCCHV.isCurrentUserOwner = function() {
    const owner = this.getLookupValue("ownerid");
    if (!owner) return false;
    return this.cleanGuid(owner.id) === this.getCurrentUserId();
};

CompleteRequest_NCCHV.runValidations = function() {
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
    
    if (!state.request.veteranOutcome) {
        errors.push("Veteran Outcome is required to resolve a Request.");
    }
    
    if (!state.request.caseNoteMemo && !state.caseNoteExistsToday) {
        errors.push("Case Note is required to resolve a Request.");
    }
    
    return errors;
};

// ============================================================================
// Business Logic
// ============================================================================

CompleteRequest_NCCHV.buildCaseNoteName = function() {
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

CompleteRequest_NCCHV.createCaseNote = async function() {
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

CompleteRequest_NCCHV.updateAuditRecord = async function() {
    try {
        const result = await this.getXrm().WebApi.retrieveMultipleRecords(
            "vhacrm_requestroutingaudit",
            `?$select=vhacrm_requestroutingauditid&$filter=_vhacrm_requestid_value eq '${this.state.request.id}'&$orderby=createdon desc&$top=1`
        );
        
        if (result.entities.length === 0) return;
        
        const auditId = result.entities[0].vhacrm_requestroutingauditid;
        
        await this.getXrm().WebApi.updateRecord("vhacrm_requestroutingaudit", auditId, {
            vhacrm_completedon_date: new Date().toISOString(),
            vhacrm_daysassigned_number: this.state.request.daysAtAssignment,
            statecode: 1,
            statuscode: 2
        });
        
        console.log("Audit record updated:", auditId);
    } catch (error) {
        console.error("Error updating audit record:", error);
    }
};

CompleteRequest_NCCHV.executeWorkflow = async function(workflowId, targetId) {
    const request = {
        entity: {
            entityType: "workflow",
            id: workflowId
        },
        EntityId: { guid: targetId },
        getMetadata: function() {
            return {
                boundParameter: "entity",
                operationType: 0,
                operationName: "ExecuteWorkflow",
                parameterTypes: {
                    "entity": {
                        typeName: "mscrm.workflow",
                        structuralProperty: 5
                    },
                    "EntityId": {
                        typeName: "Edm.Guid",
                        structuralProperty: 1
                    }
                }
            };
        }
    };
    
    await this.getXrm().WebApi.online.execute(request);
    console.log(`Workflow executed successfully: ${workflowId}`);
};

CompleteRequest_NCCHV.saveAndClose = async function() {
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

CompleteRequest_NCCHV.closeForm = function() {
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

CompleteRequest_NCCHV.execute = async function() {
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
    
    // Check for existing case notes created today
    await this.checkCaseNoteExistsToday();
    
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
        
        // Update audit record
        await this.updateAuditRecord();
        
        // Save form so workflow can read latest values
        await this.getFormContext().data.save();
        
        // Execute complete workflow: Request - NCCHV Route/Complete Request
        await this.executeWorkflow(this.config.completeWorkflowId, this.state.request.id);
        
        // Close form
        await this.closeForm();
        
    } catch (error) {
        console.error("Error completing request:", error);
        this.showError(error.message || "An error occurred while completing the request.");
    }
};

// ============================================================================
// Auto-initialize when DOM is ready
// ============================================================================

document.addEventListener("DOMContentLoaded", function() {
    CompleteRequest_NCCHV.initialize();
});
