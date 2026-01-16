/**
 * Button Base Module
 * Shared utilities and functions for all button web resources
 */
"use strict";

var ButtonBase = ButtonBase || {};

// ============================================================================
// Context Access Functions
// ============================================================================

ButtonBase._formContext = null;
ButtonBase._currentUserId = null;

ButtonBase.getXrm = function() {
    if (parent.Xrm) return parent.Xrm;
    if (window.Xrm) return window.Xrm;
    throw new Error("Xrm is not available");
};

ButtonBase.getFormContext = function() {
    if (this._formContext) return this._formContext;
    
    if (parent.formContext) {
        this._formContext = parent.formContext;
        return this._formContext;
    }
    
    if (parent.Xrm?.Page?.data) {
        this._formContext = parent.Xrm.Page;
        return this._formContext;
    }
    
    throw new Error("Form context not available");
};

ButtonBase.getGlobalContext = function() {
    const xrm = this.getXrm();
    if (xrm.Utility?.getGlobalContext) {
        return xrm.Utility.getGlobalContext();
    }
    throw new Error("Global context not available");
};

ButtonBase.resetContext = function() {
    this._formContext = null;
    this._currentUserId = null;
};

// ============================================================================
// Utility Functions
// ============================================================================

ButtonBase.cleanGuid = function(guid) {
    if (!guid) return "";
    return guid.replace(/[{}]/g, "").toLowerCase();
};

ButtonBase.getCurrentUserId = function() {
    if (this._currentUserId) return this._currentUserId;
    this._currentUserId = this.cleanGuid(
        this.getGlobalContext().userSettings.userId
    );
    return this._currentUserId;
};

ButtonBase.getLookupValue = function(attributeName) {
    const formContext = this.getFormContext();
    const attribute = formContext.getAttribute(attributeName);
    if (!attribute) return null;
    const value = attribute.getValue();
    if (!value || value.length === 0) return null;
    return value[0];
};

ButtonBase.getAttributeValue = function(attributeName) {
    const formContext = this.getFormContext();
    const attribute = formContext.getAttribute(attributeName);
    return attribute ? attribute.getValue() : null;
};

ButtonBase.setAttributeValue = function(attributeName, value) {
    const formContext = this.getFormContext();
    const attribute = formContext.getAttribute(attributeName);
    if (attribute) {
        attribute.setValue(value);
    }
};

// ============================================================================
// UI Helper Functions
// ============================================================================

ButtonBase.showError = function(message, notificationId = "BUTTON_ERROR") {
    const formContext = this.getFormContext();
    formContext.ui.clearFormNotification(notificationId);
    formContext.ui.setFormNotification(message, "ERROR", notificationId);
};

ButtonBase.clearError = function(notificationId = "BUTTON_ERROR") {
    const formContext = this.getFormContext();
    formContext.ui.clearFormNotification(notificationId);
};

ButtonBase.showAlert = async function(message, title = "Alert") {
    const xrm = this.getXrm();
    
    if (xrm.Navigation?.openAlertDialog) {
        return await xrm.Navigation.openAlertDialog({ text: message, title: title });
    }
    
    alert(message);
};

ButtonBase.showConfirm = async function(message, title = "Confirm") {
    const xrm = this.getXrm();
    
    if (xrm.Navigation?.openConfirmDialog) {
        const result = await xrm.Navigation.openConfirmDialog({ text: message, title: title });
        return result.confirmed;
    }
    
    return confirm(message);
};

ButtonBase.setButtonLoading = function($button, isLoading, loadingText = "Processing...", normalText = "Button") {
    if (!$button) return;
    
    const buttonTextEl = $button.querySelector(".button-text");
    
    if (isLoading) {
        $button.classList.add("btn-loading");
        $button.disabled = true;
        if (buttonTextEl) buttonTextEl.textContent = loadingText;
    } else {
        $button.classList.remove("btn-loading");
        $button.disabled = false;
        if (buttonTextEl) buttonTextEl.textContent = normalText;
    }
};

// ============================================================================
// API Helper Functions
// ============================================================================

ButtonBase.retrieveRecord = async function(entityName, id, options = "") {
    return await this.getXrm().WebApi.retrieveRecord(entityName, this.cleanGuid(id), options);
};

ButtonBase.retrieveMultipleRecords = async function(entityName, options = "") {
    return await this.getXrm().WebApi.retrieveMultipleRecords(entityName, options);
};

ButtonBase.createRecord = async function(entityName, data) {
    return await this.getXrm().WebApi.createRecord(entityName, data);
};

ButtonBase.updateRecord = async function(entityName, id, data) {
    return await this.getXrm().WebApi.updateRecord(entityName, this.cleanGuid(id), data);
};

ButtonBase.deleteRecord = async function(entityName, id) {
    return await this.getXrm().WebApi.deleteRecord(entityName, this.cleanGuid(id));
};

ButtonBase.executeWorkflow = async function(workflowId, targetId) {
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

ButtonBase.getKeyValuePair = async function(keyName) {
    try {
        const result = await this.retrieveMultipleRecords(
            "bah_keyvaluepair",
            `?$select=bah_stringvalue_text&$filter=bah_name_text eq '${keyName}'&$top=1`
        );
        return result.entities.length > 0 ? result.entities[0].bah_stringvalue_text : "";
    } catch (error) {
        console.error(`Error getting key value pair ${keyName}:`, error);
        return "";
    }
};

// ============================================================================
// Form Operations
// ============================================================================

ButtonBase.saveForm = async function() {
    await this.getFormContext().data.save();
};

ButtonBase.saveAndClose = async function() {
    await this.saveForm();
    this.closeForm();
};

ButtonBase.closeForm = function() {
    const xrm = this.getXrm();
    if (xrm.Navigation?.navigateBack) {
        xrm.Navigation.navigateBack();
    } else {
        this.getFormContext().ui.close();
    }
};

ButtonBase.refreshForm = function() {
    this.getFormContext().data.refresh(true);
};

// ============================================================================
// Validation Helpers
// ============================================================================

ButtonBase.isCurrentUserOwner = function() {
    const owner = this.getLookupValue("ownerid");
    if (!owner) return false;
    return this.cleanGuid(owner.id) === this.getCurrentUserId();
};

ButtonBase.isFieldPopulated = function(attributeName) {
    const value = this.getAttributeValue(attributeName);
    if (value === null || value === undefined) return false;
    if (typeof value === "string") return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return true;
};

ButtonBase.isLookupPopulated = function(attributeName) {
    return this.getLookupValue(attributeName) !== null;
};

// ============================================================================
// Dynamic Script Loading
// ============================================================================

ButtonBase.loadScript = function(src) {
    return new Promise((resolve, reject) => {
        // Check if already loaded
        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing) {
            resolve();
            return;
        }
        
        const script = document.createElement("script");
        script.src = src;
        script.async = false;
        script.onload = resolve;
        script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
        document.head.appendChild(script);
    });
};

// ============================================================================
// Date Helpers
// ============================================================================

ButtonBase.getTodayRange = function() {
    const today = new Date();
    return {
        start: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0)),
        end: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59))
    };
};

ButtonBase.formatDateForOData = function(date) {
    return date.toISOString();
};
