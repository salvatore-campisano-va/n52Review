/**
 * IVD Complete Request Button - Core Module
 * Modernized with async/await, proper error handling, and configurable validation
 */
"use strict";

var IVDCompleteRequest = IVDCompleteRequest || {};

// ============================================================================
// Configuration
// ============================================================================

IVDCompleteRequest.config = {
    workflows: {
        // Workflow "Request - Deactivate"
        deactivate: "579F4A5D-E67E-404E-AA3A-896C3D5392FC", 
        // Workflow "EED-Request Complete Request"
        completeRequest: "68E7DAE8-93A7-4F73-AFB4-77C565E211CE"
    },
    
    resolutions: {
        createdInError: "Created in Error",
        pendingRad: "Pending Future RAD"
    }
};

// ============================================================================
// State
// ============================================================================

IVDCompleteRequest.state = {
    formContext: null,
    $button: null,
    currentUserId: null,
    
    request: {
        id: null,
        veteran: null,
        type: null,
        resolution: null,
        resolutionName: null,
        verificationMethod: null,
        radDate: null,
        reevaluateDate: null,
        icn: null,
        hecAlert: null,
        daysAtAssignment: null
    },
    
    flags: {
        isCreatedInError: false,
        isPendingRad: false
    },
    
    enrollmentStatus: null,
    auditRecordId: null
};

// ============================================================================
// Initialization
// ============================================================================

IVDCompleteRequest.initialize = function() {
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
            self.showError("An unexpected error occurred. Please try again.");
        } finally {
            self.setButtonLoading(false);
        }
    });
    
    console.log("IVD Complete Request button initialized");
};

// ============================================================================
// UI Helper Functions
// ============================================================================

IVDCompleteRequest.setButtonLoading = function(isLoading) {
    if (!this.$button) return;
    
    if (isLoading) {
        this.$button.classList.add("btn-loading");
        this.$button.querySelector(".button-text").textContent = "Processing...";
    } else {
        this.$button.classList.remove("btn-loading");
        this.$button.querySelector(".button-text").textContent = "Complete Request";
    }
};

IVDCompleteRequest.showError = function(message) {
    const formContext = this.getFormContext();
    formContext.ui.clearFormNotification("IVD_ERROR");
    formContext.ui.setFormNotification(message, "ERROR", "IVD_ERROR");
};

IVDCompleteRequest.clearError = function() {
    const formContext = this.getFormContext();
    formContext.ui.clearFormNotification("IVD_ERROR");
};

IVDCompleteRequest.showAlert = async function(message, title = "Alert") {
    const xrm = this.getXrm();
    
    if (xrm.Navigation?.openAlertDialog) {
        return await xrm.Navigation.openAlertDialog({ text: message, title:  title });
    }
    
    alert(message);
};

// ============================================================================
// Context Access Functions
// ============================================================================

IVDCompleteRequest.getXrm = function() {
    if (parent.Xrm) return parent.Xrm;
    if (window.Xrm) return window.Xrm;
    throw new Error("Xrm is not available");
};

IVDCompleteRequest.getFormContext = function() {
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

IVDCompleteRequest.cleanGuid = function(guid) {
    if (!guid) return "";
    return guid.replace(/[{}]/g, "").toLowerCase();
};

IVDCompleteRequest.getCurrentUserId = function() {
    if (this.state.currentUserId) return this.state.currentUserId;
    this.state.currentUserId = this.cleanGuid(
        this.getXrm().Utility.getGlobalContext().userSettings.userId
    );
    return this.state.currentUserId;
};

IVDCompleteRequest.getLookupValue = function(attributeName) {
    const formContext = this.getFormContext();
    const attribute = formContext.getAttribute(attributeName);
    if (!attribute) return null;
    const value = attribute.getValue();
    if (!value || value.length === 0) return null;
    return value[0];
};

IVDCompleteRequest.getAttributeValue = function(attributeName) {
    const formContext = this.getFormContext();
    const attribute = formContext.getAttribute(attributeName);
    return attribute ? attribute.getValue() : null;
};

// ============================================================================
// Data Loading
// ============================================================================

IVDCompleteRequest.loadFormData = function() {
    const formContext = this.getFormContext();
    const state = this.state;
    
    state.request.id = this.cleanGuid(formContext.data.entity.getId());
    state.request.veteran = this.getLookupValue("customerid");
    state.request.type = this.getLookupValue("vhacrm_typeintersectionid");
    state.request.resolution = this.getLookupValue("vhacrm_resolutionintersectionid");
    state.request.radDate = this.getAttributeValue("vhacrm_raddate_date");
    state.request.reevaluateDate = this.getAttributeValue("vhacrm_reevaluatedate_date");
    state.request.icn = this.getAttributeValue("vhacrm_icn_text");
    state.request.hecAlert = this.getLookupValue("vhacrm_hecalertid");
    state.request.daysAtAssignment = this.getAttributeValue("vhacrm_daysatassignment_number");
};

IVDCompleteRequest.loadVerificationMethod = async function() {
    const requestId = this.state.request.id;
    if (!requestId) return;
    
    try {
        // Query the incident record for the verification method lookup value
        // The lookup field is stored as _vhacrm_verificationmethodid_value in OData
        const result = await this.getXrm().WebApi.retrieveRecord(
            "incident",
            requestId,
            "?$select=_vhacrm_verificationmethodid_value"
        );
        
        // Check if the lookup has a value
        if (result._vhacrm_verificationmethodid_value) {
            this.state.request.verificationMethod = {
                id: result._vhacrm_verificationmethodid_value,
                // The formatted value contains the name if available
                name: result["_vhacrm_verificationmethodid_value@OData.Community.Display.V1.FormattedValue"] || "",
                entityType: result["_vhacrm_verificationmethodid_value@Microsoft.Dynamics.CRM.lookuplogicalname"] || "vhacrm_verificationmethod"
            };
        } else {
            this.state.request.verificationMethod = null;
        }
    } catch (error) {
        console.error("Error loading verification method:", error);
        this.state.request.verificationMethod = null;
    }
};

IVDCompleteRequest.loadResolutionName = async function() {
    if (!this.state.request.resolution) return;
    
    const resolutionId = this.cleanGuid(this.state.request.resolution.id);
    
    try {
        const result = await this.getXrm().WebApi.retrieveRecord(
            "vhacrm_resolutionintersection",
            resolutionId,
            "?$select=vhacrm_name"
        );
        this.state.request.resolutionName = result.vhacrm_name || "";
    } catch (error) {
        console.error("Error loading resolution name:", error);
        this.state.request.resolutionName = "";
    }
    
    const resName = this.state.request.resolutionName;
    const resolutions = this.config.resolutions;
    
    this.state.flags.isCreatedInError = resName === resolutions.createdInError;
    this.state.flags.isPendingRad = resName === resolutions.pendingRad;
};

// ============================================================================
// Validation
// ============================================================================

IVDCompleteRequest.isCurrentUserOwner = function() {
    const owner = this.getLookupValue("ownerid");
    if (!owner) return false;
    return this.cleanGuid(owner.id) === this.getCurrentUserId();
};

IVDCompleteRequest.runValidations = async function() {
    const errors = [];
    const state = this.state;
    const flags = state.flags;
    
    if (flags.isCreatedInError) {
        return errors;
    }
    
    if (!state.request.veteran) {
        errors.push("A Veteran is required to complete the request.");
    }
    
    if (!state.request.verificationMethod) {
        errors.push("Verification Method is required to complete the request.");
    }
    
    if (flags.isPendingRad) {
        if (!state.request.radDate) {
            errors.push("RAD Date is required to complete the request.");
        }
        if (!state.request.reevaluateDate) {
            errors.push("Reevaluate Date is required to complete the request.");
        }
    }
    
    return errors;
};

// ============================================================================
// Business Logic
// ============================================================================

IVDCompleteRequest.updateAuditRecord = async function() {
    try {
        const result = await this.getXrm().WebApi.retrieveMultipleRecords(
            "vhacrm_requestroutingaudit",
            `?$select=vhacrm_requestroutingauditid&$filter=_vhacrm_requestid_value eq '${this.state.request.id}'&$orderby=createdon desc&$top=1`
        );
        
        if (result.entities.length === 0) return;
        
        const auditId = result.entities[0].vhacrm_requestroutingauditid;
        
        await this.updateRecord("vhacrm_requestroutingaudit", auditId, {
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

IVDCompleteRequest.callEnrollmentStatusAPI = async function() {
    if (!this.state.request.icn) return;
    
    try {
        const endpoint = await this.getKeyValuePair("esr_endpoint");
        if (!endpoint) return;
        
        const url = endpoint.replace("{0}", this.state.request.icn);
        
        const response = await fetch(url);
        if (response.ok) {
            const json = await response.json();
            this.state.enrollmentStatus = json.Data?.EnrollmentDeterminationInfo?.EnrollmentStatus || "";
        }
    } catch (error) {
        console.error("Error calling enrollment status API:", error);
    }
};

IVDCompleteRequest.updateHecAlert = async function() {
    if (!this.state.request.hecAlert) return;
    
    const hecAlertId = this.cleanGuid(this.state.request.hecAlert.id);
    
    try {
        await this.updateRecord("vhacrm_hecalert", hecAlertId, {
            statecode: 1,
            statuscode:  713770006
        });
        
        console.log("HEC Alert updated");
    } catch (error) {
        console.error("Error updating HEC Alert:", error);
    }
};

IVDCompleteRequest.updateRequestRecord = async function() {
    try {
        const baseUrl = await this.getKeyValuePair("base_url");
        const recordUrl = baseUrl 
            ? `${baseUrl}main.aspx?etn=incident&id=${this.state.request.id}&pagetype=entityrecord`
            : "";
        
        await this.updateRecord("incident", this.state.request.id, {
            vhacrm_recordurl_memo: recordUrl,
            vhacrm_enrollmentstatus_text: this.state.enrollmentStatus || ""
        });
    } catch (error) {
        console.error("Error updating request record:", error);
    }
};

// ============================================================================
// API Helper Functions
// ============================================================================

IVDCompleteRequest.updateRecord = async function(entityName, id, data) {
    try {
        await this.getXrm().WebApi.updateRecord(entityName, id, data);
    } catch (error) {
        console.error(`Error updating ${entityName}:`, error);
        throw error;
    }
};

IVDCompleteRequest.getKeyValuePair = async function(keyName) {
    try {
        const result = await this.getXrm().WebApi.retrieveMultipleRecords(
            "bah_keyvaluepair",
            `?$select=bah_stringvalue_text&$filter=bah_name_text eq '${keyName}'&$top=1`
        );
        return result.entities.length > 0 ? result.entities[0].bah_stringvalue_text : "";
    } catch (error) {
        console.error(`Error getting key value pair ${keyName}:`, error);
        return "";
    }
};

IVDCompleteRequest.executeWorkflow = async function(workflowId, targetId) {
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

// ============================================================================
// Main Execution Flow
// ============================================================================

IVDCompleteRequest.execute = async function() {
    this.clearError();
    
    const resolution = this.getLookupValue("vhacrm_resolutionintersectionid");
    if (!resolution) {
        this.showError("A Resolution must be provided before completing the request.");
        return;
    }
    
    if (!this.isCurrentUserOwner()) {
        this.showError("You must pick the request from the queue before completing the request.");
        return;
    }
    
    this.loadFormData();
    
    await this.loadResolutionName();
    
    if (this.state.flags.isCreatedInError) {
        await this.handleCreatedInError();
        return;
    }
    
    // Load verification method (relationship)
    await this.loadVerificationMethod();
    
    const validationErrors = await this.runValidations();
    
    if (validationErrors.length > 0) {
        this.showError(validationErrors.join(" | "));
        return;
    }
    
    await this.completeRequest();
};

IVDCompleteRequest.handleCreatedInError = async function() {
    try {
        await this.executeWorkflow(this.config.workflows.deactivate, this.state.request.id);
        
        await this.updateRecord("incident", this.state.request.id, {
            vhacrm_returnemailnotes: "saveandclose"
        });
        
        await this.saveAndClose();
    } catch (error) {
        console.error("Error handling Created in Error:", error);
        this.showError(error.message || "Failed to process Created in Error request.");
    }
};

IVDCompleteRequest.completeRequest = async function() {
    try {
        await this.updateAuditRecord();
        await this.callEnrollmentStatusAPI();
        await this.updateRequestRecord();
        await this.updateHecAlert();
        
        await this.executeWorkflow(
            this.config.workflows.completeRequest, 
            this.state.request.id
        );
        
        await this.saveAndClose();
        
    } catch (error) {
        console.error("Error completing request:", error);
        this.showError(error.message || "An error occurred while completing the request. Please try again.");
    }
};

IVDCompleteRequest.saveAndClose = async function() {
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
        this.showError("Failed to save the record. Please try again.");
    }
};

// ============================================================================
// Auto-initialize when DOM is ready
// ============================================================================

document.addEventListener("DOMContentLoaded", function() {
    IVDCompleteRequest.initialize();
});