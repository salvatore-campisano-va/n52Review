/**
 * Next Step Button - Core Module
 * Contains all shared logic for the Next Step button across all Lines of Business
 */
var NextStepButton = NextStepButton || {};

// ============================================================================
// Configuration (can be overridden by LOB-specific files)
// ============================================================================

NextStepButton.config = {
    lobName: "Default",
    
    requiredFields: {
        type:  { field: "vhacrm_typeintersectionid", message: "Type is required for next step." },
        area: { field: "vhacrm_areaintersectionid", message: "Area is required for next step." },
        facility: { field: "vhacrm_facilityid", message:  "Facility is required for next step." },
        facilityPharmacy: { field:  "vhacrm_facilitypharmacyid", message:  "Facility Pharmacy is required for next step." },
        veteran: { field: "customerid", message: "Veteran is required for next step." }
    },
    
    caseNote: {
        entityName: "vhacrm_casenote",
        caseNoteTypeCode: 168790000,
        requireCaseNote: true
    },
    
    caseNoteNameFields: [
        "vhacrm_lobid",
        "vhacrm_typeintersectionid",
        "vhacrm_areaintersectionid",
        "vhacrm_subareaintersectionid"
    ],
    
    customValidation: null,
    beforeSave: null,
    afterSave: null
};

// ============================================================================
// LOB Configuration Mapping
// ============================================================================

// Map LOB names (from vhacrm_lobid lookup) to their configuration file names
NextStepButton.lobMapping = {
    "PCC": "PCCNextStepButton",
    // Add more LOB mappings as needed
};

// ============================================================================
// LOB Configuration Loader
// ============================================================================

NextStepButton.loadLobConfiguration = async function() {
    try {
        const formContext = this.getFormContext();
        const lobLookup = this.getLookupValue(formContext, "vhacrm_lobid");
        
        if (!lobLookup || !lobLookup.name) {
            console.warn("No LOB selected on form.  Using default configuration.");
            this.initialize();
            return;
        }
        
        const lobName = lobLookup.name;
        const lobScript = this.lobMapping[lobName];
        
        if (lobScript) {
            await this.loadScript(`/WebResources/${lobScript}.js`);
            console.log(`Loaded LOB configuration:  ${lobName}`);
        } else {
            console.warn(`No LOB configuration found for: ${lobName}. Using defaults.`);
        }
        
        this.config.lobName = lobName;
        this.initialize();
        
    } catch (error) {
        console.error("Error loading LOB configuration:", error);
        // Initialize with default configuration
        this.initialize();
    }
};

NextStepButton.loadScript = function(src) {
    return new Promise((resolve, reject) => {
        const script = document. createElement("script");
        script.src = src;
        script.onload = resolve;
        script. onerror = reject;
        document.head.appendChild(script);
    });
};

// ============================================================================
// Initialization
// ============================================================================

NextStepButton.initialize = function() {
    const self = this;
    
    $("#NextStep").click(async function() {
        const $button = $(this);
        
        if ($button.hasClass("btn-loading")) {
            return;
        }

        try {
            self.setButtonLoading($button, true);
            await self.executeValidationAndAction();
        } catch (error) {
            console. error("Error in NextStep click handler:", error);
            await self.showAlert("An unexpected error occurred. Please try again.");
        } finally {
            self. setButtonLoading($button, false);
        }
    });
    
    console.log(`Next Step Button initialized for LOB: ${this. config.lobName}`);
};

// ============================================================================
// UI Helper Functions
// ============================================================================

NextStepButton.setButtonLoading = function($button, isLoading) {
    if (isLoading) {
        $button.addClass("btn-loading").prop("disabled", true);
        $button.find(".button-text").text("Processing...");
        $button.find(".spinner-border").removeClass("d-none");
    } else {
        $button.removeClass("btn-loading").prop("disabled", false);
        $button.find(".button-text").text("Next Step");
        $button.find(".spinner-border").addClass("d-none");
    }
};

NextStepButton.showAlert = async function(message, title = "Alert") {
    const xrm = this.getXrm();
    
    if (xrm.Navigation?. openAlertDialog) {
        return await xrm.Navigation.openAlertDialog({ text: message, title: title });
    }
    
    return new Promise((resolve) => {
        if (xrm.Utility?. alertDialog) {
            xrm.Utility.alertDialog(message, resolve);
        } else {
            alert(message);
            resolve();
        }
    });
};

// ============================================================================
// Context Access Functions
// ============================================================================

NextStepButton.getXrm = function() {
    if (parent.Xrm) return parent.Xrm;
    if (window.Xrm) return window.Xrm;
    throw new Error("Xrm is not available");
};

NextStepButton. getFormContext = function() {
    if (parent.Ms?.Common?.GlobalContext?. formContext) {
        return parent. Ms.Common.GlobalContext.formContext;
    }
    if (parent.Xrm?. Page?.data) {
        return parent.Xrm.Page;
    }
    throw new Error("Form context not available");
};

NextStepButton.getGlobalContext = function() {
    if (parent.Ms?.Common?. GlobalContext?.globalContext) {
        return parent.Ms.Common. GlobalContext.globalContext;
    }
    const xrm = this.getXrm();
    if (xrm. Utility?.getGlobalContext) {
        return xrm. Utility.getGlobalContext();
    }
    throw new Error("Global context not available");
};

// ============================================================================
// Utility Functions
// ============================================================================

NextStepButton.cleanGuid = function(guid) {
    if (!guid) return "";
    return guid.replace(/[{}]/g, "").toLowerCase();
};

NextStepButton.getCurrentUserId = function() {
    const globalContext = this.getGlobalContext();
    return this.cleanGuid(globalContext.userSettings. userId);
};

NextStepButton.getLookupValue = function(formContext, attributeName) {
    const attribute = formContext. getAttribute(attributeName);
    if (!attribute) return null;
    const value = attribute.getValue();
    if (!value || value.length === 0) return null;
    return value[0];
};

// ============================================================================
// Validation Functions
// ============================================================================

NextStepButton.validateRequiredFields = function(formContext) {
    const errors = [];
    const requiredFields = this. config. requiredFields;
    
    for (const key in requiredFields) {
        const fieldConfig = requiredFields[key];
        if (!this.getLookupValue(formContext, fieldConfig.field)) {
            errors.push(fieldConfig. message);
        }
    }
    
    return errors;
};

NextStepButton.checkCaseNoteExists = async function(incidentId, owningUserId) {
    const xrm = this.getXrm();
    const cleanIncidentId = this.cleanGuid(incidentId);
    const cleanOwningUserId = this. cleanGuid(owningUserId);
    
    const query = `?$select=vhacrm_name&$top=1&$filter=_vhacrm_requestid_value eq '${cleanIncidentId}' and _createdby_value eq '${cleanOwningUserId}'`;
    
    try {
        const response = await xrm.WebApi.retrieveMultipleRecords(this.config.caseNote.entityName, query);
        return response.entities.length > 0;
    } catch (error) {
        console.error("Error checking case note existence:", error);
        throw new Error("Failed to check for existing case notes.");
    }
};

// ============================================================================
// Case Note Functions
// ============================================================================

NextStepButton.buildCaseNoteName = function(formContext) {
    const parts = [];
    
    this. config.caseNoteNameFields.forEach((fieldName) => {
        const lookup = this.getLookupValue(formContext, fieldName);
        if (lookup?. name) {
            parts.push(lookup.name);
        }
    });
    
    return parts.join("/");
};

NextStepButton.createCaseNote = async function(name, memo, incidentId, veteranId, caseNoteTemplateId) {
    const xrm = this.getXrm();

    const caseNote = {
        vhacrm_name: name,
        vhacrm_casenotes_memo: memo,
        "vhacrm_requestid@odata.bind": `/incidents(${this.cleanGuid(incidentId)})`,
        "vhacrm_veteranid@odata.bind":  `/contacts(${this.cleanGuid(veteranId)})`,
        vhacrm_casenotetype_code: this. config.caseNote.caseNoteTypeCode
    };

    if (caseNoteTemplateId) {
        caseNote["vhacrm_casenotetemplateid@odata.bind"] = `/vhacrm_casenotetemplates(${this.cleanGuid(caseNoteTemplateId)})`;
    }

    try {
        const result = await xrm.WebApi.createRecord(this.config.caseNote.entityName, caseNote);
        console.log("Case note created with ID:", result.id);
        return result;
    } catch (error) {
        console.error("Error creating case note:", error);
        throw new Error("Failed to create case note.");
    }
};

// ============================================================================
// Main Execution Function
// ============================================================================

NextStepButton.executeValidationAndAction = async function() {
    const formContext = this.getFormContext();
    const currentUserId = this.getCurrentUserId();

    // Check if action is selected
    const actionIntersection = this.getLookupValue(formContext, "vhacrm_actionintersectionid");
    if (!actionIntersection) {
        await this.showAlert("Please select an Action before continuing.");
        return;
    }

    // Check if current user is the owner
    const owner = this.getLookupValue(formContext, "ownerid");
    if (!owner) {
        await this.showAlert("Unable to determine the record owner.");
        return;
    }
    
    const ownerId = this.cleanGuid(owner. id);
    if (currentUserId !== ownerId) {
        await this.showAlert("You must pick the request from the queue before proceeding.");
        return;
    }

    // Run standard validation
    const validationErrors = this.validateRequiredFields(formContext);

    // Run LOB-specific custom validation if defined
    if (typeof this.config.customValidation === "function") {
        const customErrors = await this.config.customValidation(formContext, this);
        if (customErrors?. length > 0) {
            validationErrors.push(...customErrors);
        }
    }

    // Check case note requirement
    if (this.config.caseNote.requireCaseNote) {
        const incidentId = formContext.data.entity.getId();
        const owningUserId = this.getLookupValue(formContext, "owninguser")?.id;
        const caseNotesMemo = formContext.getAttribute("vhacrm_casenotes_memo")?.getValue();
        const caseNoteExists = await this.checkCaseNoteExists(incidentId, owningUserId);

        if (!caseNotesMemo && !caseNoteExists) {
            validationErrors.push("Please enter a Case Note before proceeding with action.");
        }
    }

    // Show validation errors if any
    if (validationErrors.length > 0) {
        const errorMessage = "Please correct the following:\n\n• " + validationErrors.join("\n• ");
        await this. showAlert(errorMessage, "Validation Errors");
        return;
    }

    // Create case note if memo exists
    const caseNotesMemo = formContext.getAttribute("vhacrm_casenotes_memo")?.getValue();
    if (caseNotesMemo) {
        const incidentId = formContext.data. entity.getId();
        const noteName = this.buildCaseNoteName(formContext);
        const customer = this.getLookupValue(formContext, "customerid");
        const template = this.getLookupValue(formContext, "vhacrm_casenotetemplateid");

        await this.createCaseNote(
            noteName,
            caseNotesMemo,
            incidentId,
            customer. id,
            template?. id
        );
    }

    // Run LOB-specific before save action if defined
    if (typeof this. config.beforeSave === "function") {
        await this.config.beforeSave(formContext, this);
    }

    // Set flag and save
    const nextActionAttr = formContext.getAttribute("vhacrm_onpccnextactionbutton");
    if (nextActionAttr) {
        nextActionAttr.setValue(true);
    }

    formContext.data.save({ saveMode: 2 }).then(
        async () => {
            if (typeof this.config.afterSave === "function") {
                await this.config.afterSave(formContext, this);
            }
            
            const xrm = this.getXrm();
            if (xrm.Navigation?.navigateBack) {
                xrm.Navigation.navigateBack();
            } else {
                formContext.ui.close();
            }
        },
        (error) => {
            console. error("Error saving record:", error);
            this.showAlert("Failed to save the record. Please try again.");
        }
    );
};

// ============================================================================
// Auto-initialize when DOM is ready
// ============================================================================

$(document).ready(function() {
    NextStepButton.loadLobConfiguration();
});