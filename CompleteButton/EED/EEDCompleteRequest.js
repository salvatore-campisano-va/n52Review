/**
 * EED Complete Request Button - Core Module
 * Handles validation and completion for EED (Enrollment Eligibility Division) requests
 */
"use strict";

var EEDCompleteRequest = EEDCompleteRequest || {};

// ============================================================================
// Configuration
// ============================================================================

EEDCompleteRequest.config = {
    // Case note type code
    caseNoteTypeCode: 168790000,
    
    // Workflow: EED-Request Complete Request
    completeWorkflowId: "68E7DAE8-93A7-4F73-AFB4-77C565E211CE",
    
    // Workflow: Request - Deactivate
    deactivateWorkflowId: "579F4A5D-E67E-404E-AA3A-896C3D5392FC",
    
    // Placeholder Veteran GUID (No Veteran, No Veteran)
    placeholderVeteranId: "1b8680e1-8d87-e611-9422-0050568dade6",
    
    // Special resolution names
    resolutions: {
        createdInError: "Created in Error",
        pendingFutureRAD: "Pending Future RAD"
    },
    
    // HEC Alert completed status
    hecAlertCompletedStatusCode: 713770006
};

// ============================================================================
// State
// ============================================================================

EEDCompleteRequest.state = {
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
        resolutionName: null,
        verificationMethod: null,
        caseNoteMemo: null,
        caseNoteTemplate: null,
        lob: null,
        subArea: null,
        radDate: null,
        reevaluateDate: null,
        noContactRequired: null,
        hecAlert: null
    },
    
    // Resolution flags
    isCreatedInError: false,
    isPendingFutureRAD: false,
    isPlaceholderVeteran: false,
    
    // Activity counts
    counts: {
        correspondence: 0,
        phoneCalls: 0
    },
    
    // Case note check
    caseNoteExistsToday: false
};

// ============================================================================
// Initialization
// ============================================================================

EEDCompleteRequest.initialize = function() {
    const self = this;
    
    this.$button = document.getElementById("CompleteRequest");
    
    if (!this.$button) {
        console.error("CompleteRequest button not found");
        return;
    }
    
    this.$button.addEventListener("click", async function() {
        if (self.$button.classList.contains("btn-loading")) return;
        
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
    
    console.log("EED Complete Request button initialized");
};

// ============================================================================
// UI Helper Functions
// ============================================================================

EEDCompleteRequest.setButtonLoading = function(isLoading) {
    if (!this.$button) return;
    
    if (isLoading) {
        this.$button.classList.add("btn-loading");
        this.$button.querySelector(".button-text").textContent = "Processing...";
    } else {
        this.$button.classList.remove("btn-loading");
        this.$button.querySelector(".button-text").textContent = "Complete Request";
    }
};

EEDCompleteRequest.showError = function(message) {
    const formContext = this.getFormContext();
    formContext.ui.clearFormNotification("EED_ERROR");
    formContext.ui.setFormNotification(message, "ERROR", "EED_ERROR");
};

EEDCompleteRequest.clearError = function() {
    const formContext = this.getFormContext();
    formContext.ui.clearFormNotification("EED_ERROR");
};

EEDCompleteRequest.showAlert = async function(message, title = "Alert") {
    const xrm = this.getXrm();
    
    if (xrm.Navigation?.openAlertDialog) {
        return await xrm.Navigation.openAlertDialog({ text: message, title: title });
    }
    
    alert(message);
};

// ============================================================================
// Context Access Functions
// ============================================================================

EEDCompleteRequest.getXrm = function() {
    if (parent.Xrm) return parent.Xrm;
    if (window.Xrm) return window.Xrm;
    throw new Error("Xrm is not available");
};

EEDCompleteRequest.getFormContext = function() {
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

EEDCompleteRequest.cleanGuid = function(guid) {
    if (!guid) return "";
    return guid.replace(/[{}]/g, "").toLowerCase();
};

EEDCompleteRequest.getCurrentUserId = function() {
    if (this.state.currentUserId) return this.state.currentUserId;
    this.state.currentUserId = this.cleanGuid(
        this.getXrm().Utility.getGlobalContext().userSettings.userId
    );
    return this.state.currentUserId;
};

EEDCompleteRequest.getLookupValue = function(attributeName) {
    const formContext = this.getFormContext();
    const attribute = formContext.getAttribute(attributeName);
    if (!attribute) return null;
    const value = attribute.getValue();
    if (!value || value.length === 0) return null;
    return value[0];
};

EEDCompleteRequest.getAttributeValue = function(attributeName) {
    const formContext = this.getFormContext();
    const attribute = formContext.getAttribute(attributeName);
    return attribute ? attribute.getValue() : null;
};

// ============================================================================
// Data Loading
// ============================================================================

EEDCompleteRequest.loadFormData = function() {
    const formContext = this.getFormContext();
    const state = this.state;
    
    state.request.id = this.cleanGuid(formContext.data.entity.getId());
    state.request.veteran = this.getLookupValue("customerid");
    state.request.type = this.getLookupValue("vhacrm_typeintersectionid");
    state.request.area = this.getLookupValue("vhacrm_areaintersectionid");
    state.request.facility = this.getLookupValue("vhacrm_facilityid");
    state.request.resolution = this.getLookupValue("vhacrm_resolutionintersectionid");
    state.request.verificationMethod = this.getLookupValue("vhacrm_verificationmethodid");
    state.request.caseNoteMemo = this.getAttributeValue("vhacrm_casenotes_memo");
    state.request.caseNoteTemplate = this.getLookupValue("vhacrm_casenotetemplateid");
    state.request.lob = this.getLookupValue("vhacrm_lobid");
    state.request.subArea = this.getLookupValue("vhacrm_subareaintersectionid");
    state.request.radDate = this.getAttributeValue("vhacrm_raddate_date");
    state.request.reevaluateDate = this.getAttributeValue("vhacrm_reevaluatedate_date");
    state.request.noContactRequired = this.getAttributeValue("vhacrm_nocontactrequired_bool");
    state.request.hecAlert = this.getLookupValue("vhacrm_hecalertid");
    
    // Set placeholder veteran flag
    if (state.request.veteran) {
        state.isPlaceholderVeteran = this.cleanGuid(state.request.veteran.id) === this.config.placeholderVeteranId;
    }
};

EEDCompleteRequest.loadResolutionName = async function() {
    const resolution = this.state.request.resolution;
    if (!resolution) return;
    
    try {
        const result = await this.getXrm().WebApi.retrieveRecord(
            "vhacrm_resolutionintersection",
            this.cleanGuid(resolution.id),
            "?$select=vhacrm_name"
        );
        
        this.state.request.resolutionName = result.vhacrm_name;
        
        // Set resolution flags
        const name = result.vhacrm_name;
        this.state.isCreatedInError = name === this.config.resolutions.createdInError;
        this.state.isPendingFutureRAD = name === this.config.resolutions.pendingFutureRAD;
        
    } catch (error) {
        console.error("Error loading resolution name:", error);
    }
};

EEDCompleteRequest.loadActivityCounts = async function() {
    const requestId = this.state.request.id;
    
    try {
        const correspondenceResult = await this.getRelatedEntityCount("vhacrm_correspondence", requestId);
        
        const phoneCallResult = await this.getPhoneCallCount(requestId);
        
        this.state.counts.correspondence = correspondenceResult;
        this.state.counts.phoneCalls = phoneCallResult;
    } catch (error) {
        console.error("Error loading activity counts:", error);
        this.state.counts.correspondence = 0;
        this.state.counts.phoneCalls = 0;
    }
};

EEDCompleteRequest.getRelatedEntityCount = async function(entityName, requestId) {
    try {
        const result = await this.getXrm().WebApi.retrieveMultipleRecords(
            entityName,
            `?$filter=_vhacrm_requestid_value eq '${requestId}'&$select=${entityName}id`
        );
        return result.entities.length;
    } catch (error) {
        console.error(`Error getting ${entityName} count: `, error);
        return 0;
    }
};

EEDCompleteRequest.getPhoneCallCount = async function(requestId) {
    try {
        const result = await this.getXrm().WebApi.retrieveMultipleRecords(
            "phonecall",
            `?$filter=_vhacrm_requestid_value eq '${requestId}'&$select=activityid`
        );
        return result.entities.length;
    } catch (error) {
        console.error("Error getting phone call count:", error);
        return 0;
    }
};

EEDCompleteRequest.checkCaseNoteExistsToday = async function() {
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

EEDCompleteRequest.isCurrentUserOwner = function() {
    const owner = this.getLookupValue("ownerid");
    if (!owner) return false;
    return this.cleanGuid(owner.id) === this.getCurrentUserId();
};

EEDCompleteRequest.runValidations = function() {
    const errors = [];
    const state = this.state;
    
    // Skip most validations for Created in Error resolution
    if (state.isCreatedInError) {
        return errors;
    }
    
    // Veteran is required unless customer is the placeholder veteran
    if (!state.isPlaceholderVeteran && !state.request.veteran) {
        errors.push("Veteran is required to complete the request.");
    }
    
    // Verification Method is required unless customer is placeholder veteran
    if (!state.isPlaceholderVeteran) {
        if (!state.request.verificationMethod) {
            errors.push("Verification Method is required to complete the request.");
        }
    }
    
    // Contact Method is required unless:
    // - No Contact Required flag is set
    // - Customer is placeholder veteran
    if (!state.isPlaceholderVeteran) {
        const hasContact = state.counts.correspondence > 0 || state.counts.phoneCalls > 0;
        if (!hasContact && !state.request.noContactRequired) {
            errors.push("Veteran Contact Method is Required");
        }
    }
    
    // Pending Future RAD validations
    if (state.isPendingFutureRAD) {
        if (!state.request.radDate) {
            errors.push("RAD Date is required to complete the request.");
        }
        if (!state.request.reevaluateDate) {
            errors.push("Reevaluate Date is required to complete the request.");
        }
    }
    
    // Case Note is required (memo OR existing today)
    if (!state.request.caseNoteMemo && !state.caseNoteExistsToday) {
        errors.push("A completed Case Note is required to complete the request.");
    }
    
    return errors;
};

// ============================================================================
// Business Logic
// ============================================================================

EEDCompleteRequest.buildCaseNoteName = function() {
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

EEDCompleteRequest.createCaseNote = async function() {
    if (!this.state.request.caseNoteMemo) return;
    if (!this.state.request.resolution) return;
    
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
    
    // Add HEC Alert if present
    if (this.state.request.hecAlert) {
        caseNote["vhacrm_hecalertid@odata.bind"] = `/vhacrm_hecalerts(${this.cleanGuid(this.state.request.hecAlert.id)})`;
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

EEDCompleteRequest.updateIncidentCaseNoteFields = async function() {
    // Copy case note memo to hidden field and clear template
    try {
        await this.getXrm().WebApi.updateRecord("incident", this.state.request.id, {
            vhacrm_casenotehidden: this.state.request.caseNoteMemo,
            "vhacrm_casenotetemplateid@odata.bind": null
        });
        console.log("Incident case note fields updated");
    } catch (error) {
        console.error("Error updating incident case note fields:", error);
    }
};

EEDCompleteRequest.updateIncidentRecordUrl = async function() {
    try {
        // Get base URL from key value pair
        const kvpResult = await this.getXrm().WebApi.retrieveMultipleRecords(
            "bah_keyvaluepair",
            "?$select=bah_stringvalue_text&$filter=bah_name_text eq 'base_url'&$top=1"
        );
        
        if (kvpResult.entities.length === 0) {
            console.warn("Base URL not found in key value pairs");
            return;
        }
        
        const baseUrl = kvpResult.entities[0].bah_stringvalue_text;
        const recordUrl = `${baseUrl}/main.aspx?etn=incident&id=${this.state.request.id}&pagetype=entityrecord`;
        
        await this.getXrm().WebApi.updateRecord("incident", this.state.request.id, {
            vhacrm_recordurl_memo: recordUrl
        });
        
        console.log("Record URL updated");
    } catch (error) {
        console.error("Error updating record URL:", error);
    }
};

EEDCompleteRequest.updateHecAlert = async function() {
    if (!this.state.request.hecAlert) return;
    
    try {
        await this.getXrm().WebApi.updateRecord(
            "vhacrm_hecalert",
            this.cleanGuid(this.state.request.hecAlert.id),
            {
                statecode: 1,
                statuscode: this.config.hecAlertCompletedStatusCode
            }
        );
        console.log("HEC Alert updated");
    } catch (error) {
        console.error("Error updating HEC Alert:", error);
    }
};

EEDCompleteRequest.executeWorkflow = async function(workflowId, targetId) {
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

EEDCompleteRequest.saveAndClose = async function() {
    try {
        await this.getFormContext().data.save();
        this.closeForm();
    } catch (error) {
        console.error("Error saving record:", error);
        throw new Error("Failed to save the record.");
    }
};

EEDCompleteRequest.closeForm = function() {
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

EEDCompleteRequest.execute = async function() {
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
    
    // Load resolution name to determine special handling
    await this.loadResolutionName();
    
    // Handle "Created in Error" - just deactivate and close
    if (this.state.isCreatedInError) {
        try {
            await this.executeWorkflow(this.config.deactivateWorkflowId, this.state.request.id);
            await this.saveAndClose();
        } catch (error) {
            console.error("Error handling Created in Error:", error);
            this.showError("An error occurred while processing the request.");
        }
        return;
    }
    
    // Load additional data for validation
    await Promise.all([
        this.loadActivityCounts(),
        this.checkCaseNoteExistsToday()
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
        
        // Update incident case note fields
        await this.updateIncidentCaseNoteFields();
        
        // Update incident with record URL
        await this.updateIncidentRecordUrl();
        
        // Update HEC Alert if linked
        await this.updateHecAlert();
        
        // Save form so workflow can read latest values
        await this.getFormContext().data.save();
        
        // Execute complete workflow
        await this.executeWorkflow(this.config.completeWorkflowId, this.state.request.id);
        
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
    EEDCompleteRequest.initialize();
});
