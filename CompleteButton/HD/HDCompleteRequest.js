/**
 * HD Complete Request Button - Core Module
 * Handles validation and completion for HD (Help Desk) requests
 */
"use strict";

var HDCompleteRequest = HDCompleteRequest || {};

// ============================================================================
// Configuration
// ============================================================================

HDCompleteRequest.config = {
    // Case note type code
    caseNoteTypeCode: 168790000,
    
    // Workflow: Request - HD Route/Complete Request
    completeWorkflowId: "F9A56996-0EA6-4029-95C5-06A67315EED9",
    
    // HD LOB GUID
    hdLobId: "1bd4b15a-bfbb-e511-9414-0050568dc724"
};

// ============================================================================
// State
// ============================================================================

HDCompleteRequest.state = {
    formContext: null,
    $button: null,
    currentUserId: null,
    
    request: {
        id: null,
        veteran: null,
        type: null,
        area: null,
        resolution: null,
        caseNoteMemo: null,
        caseNoteTemplate: null,
        lob: null,
        subArea: null,
        daysAtAssignment: null
    },
    
    // Case note check
    caseNoteExistsToday: false
};

// ============================================================================
// Initialization
// ============================================================================

HDCompleteRequest.initialize = function() {
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
    
    console.log("HD Complete Request button initialized");
};

// ============================================================================
// UI Helper Functions
// ============================================================================

HDCompleteRequest.setButtonLoading = function(isLoading) {
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

HDCompleteRequest.showError = function(message) {
    const formContext = this.getFormContext();
    formContext.ui.clearFormNotification("HD_ERROR");
    formContext.ui.setFormNotification(message, "ERROR", "HD_ERROR");
};

HDCompleteRequest.clearError = function() {
    const formContext = this.getFormContext();
    formContext.ui.clearFormNotification("HD_ERROR");
};

HDCompleteRequest.showAlert = async function(message, title = "Alert") {
    const xrm = this.getXrm();
    
    if (xrm.Navigation?.openAlertDialog) {
        return await xrm.Navigation.openAlertDialog({ text: message, title: title });
    }
    
    alert(message);
};

// ============================================================================
// Context Access Functions
// ============================================================================

HDCompleteRequest.getXrm = function() {
    if (parent.Xrm) return parent.Xrm;
    if (window.Xrm) return window.Xrm;
    throw new Error("Xrm is not available");
};

HDCompleteRequest.getFormContext = function() {
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

HDCompleteRequest.cleanGuid = function(guid) {
    if (!guid) return "";
    return guid.replace(/[{}]/g, "").toLowerCase();
};

HDCompleteRequest.getCurrentUserId = function() {
    if (this.state.currentUserId) return this.state.currentUserId;
    this.state.currentUserId = this.cleanGuid(
        this.getXrm().Utility.getGlobalContext().userSettings.userId
    );
    return this.state.currentUserId;
};

HDCompleteRequest.getLookupValue = function(attributeName) {
    const formContext = this.getFormContext();
    const attribute = formContext.getAttribute(attributeName);
    if (!attribute) return null;
    const value = attribute.getValue();
    if (!value || value.length === 0) return null;
    return value[0];
};

HDCompleteRequest.getAttributeValue = function(attributeName) {
    const formContext = this.getFormContext();
    const attribute = formContext.getAttribute(attributeName);
    return attribute ? attribute.getValue() : null;
};

// ============================================================================
// Data Loading
// ============================================================================

HDCompleteRequest.loadFormData = function() {
    const formContext = this.getFormContext();
    const state = this.state;
    
    state.request.id = this.cleanGuid(formContext.data.entity.getId());
    state.request.veteran = this.getLookupValue("customerid");
    state.request.type = this.getLookupValue("vhacrm_typeintersectionid");
    state.request.area = this.getLookupValue("vhacrm_areaintersectionid");
    state.request.resolution = this.getLookupValue("vhacrm_resolutionintersectionid");
    state.request.caseNoteMemo = this.getAttributeValue("vhacrm_casenotes_memo");
    state.request.caseNoteTemplate = this.getLookupValue("vhacrm_casenotetemplateid");
    state.request.lob = this.getLookupValue("vhacrm_lobid");
    state.request.subArea = this.getLookupValue("vhacrm_subareaintersectionid");
    state.request.daysAtAssignment = this.getAttributeValue("vhacrm_daysatassignment_number");
};

HDCompleteRequest.checkCaseNoteExistsToday = async function() {
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

HDCompleteRequest.isCurrentUserOwner = function() {
    const owner = this.getLookupValue("ownerid");
    if (!owner) return false;
    return this.cleanGuid(owner.id) === this.getCurrentUserId();
};

HDCompleteRequest.runValidations = function() {
    const errors = [];
    const state = this.state;
    
    // Case Note is required (memo OR existing today)
    if (!state.request.caseNoteMemo && !state.caseNoteExistsToday) {
        errors.push("A completed case note is required to complete the request.");
    }
    
    return errors;
};

// ============================================================================
// Business Logic
// ============================================================================

HDCompleteRequest.buildCaseNoteName = function() {
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

HDCompleteRequest.createCaseNote = async function() {
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

HDCompleteRequest.executeWorkflow = async function(workflowId, targetId) {
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

HDCompleteRequest.saveAndClose = async function() {
    try {
        await this.getFormContext().data.save();
        this.closeForm();
    } catch (error) {
        console.error("Error saving record:", error);
        throw new Error("Failed to save the record.");
    }
};

HDCompleteRequest.closeForm = function() {
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

HDCompleteRequest.execute = async function() {
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
    
    // Load additional data for validation
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
        
        // Save form so workflow can read latest values
        await this.getFormContext().data.save();
        
        // Execute complete workflow (only for HD LOB)
        if (this.state.request.lob) {
            const lobId = this.cleanGuid(this.state.request.lob.id);
            if (lobId === this.config.hdLobId) {
                await this.executeWorkflow(this.config.completeWorkflowId, this.state.request.id);
            }
        }
        
        // Close form
        this.closeForm();
        
    } catch (error) {
        console.error("Error completing request:", error);
        this.showError(error.message || "An error occurred while completing the request.");
    }
};

// ============================================================================
// Auto-initialize when DOM is ready
// ============================================================================

document.addEventListener("DOMContentLoaded", function() {
    HDCompleteRequest.initialize();
});
