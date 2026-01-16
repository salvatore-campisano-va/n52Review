/**
 * Next Step Button - Base Module
 * Contains shared functionality for all LOBs
 * Extends ButtonBase for common utilities
 */
"use strict";

var NextStepButton = NextStepButton || {};

// ============================================================================
// LOB Registry - LOB modules register themselves here
// ============================================================================

NextStepButton.lobHandlers = {};

// Map LOB names to script files
NextStepButton.lobScriptMap = {
    "pcc": "NextStepButton_PCC.js",
    "ncchv": "NextStepButton_NCCHV.js"
};

NextStepButton.registerLOB = function(lobName, handler) {
    this.lobHandlers[lobName.toLowerCase()] = handler;
    console.log(`LOB handler registered: ${lobName}`);
};

// ============================================================================
// Configuration - Base config, LOBs extend this
// ============================================================================

NextStepButton.config = {
    // Case note configuration
    caseNote: {
        entityName: "vhacrm_casenote",
        caseNoteTypeCode: 168790000
    },
    
    // Fields used to build case note name
    caseNoteNameFields: [
        "vhacrm_lobid",
        "vhacrm_typeintersectionid",
        "vhacrm_areaintersectionid",
        "vhacrm_subareaintersectionid"
    ]
};

// ============================================================================
// State - Base state, LOBs extend this
// ============================================================================

NextStepButton.state = {
    $button: null,
    currentLOB: null,
    
    request: {
        id: null,
        lob: null,
        lobName: null,
        veteran: null,
        type: null,
        area: null,
        subArea: null,
        facility: null,
        action: null,
        caseNoteMemo: null,
        caseNoteTemplate: null
    },
    
    flags: {
        caseNoteExists: false
    },
    
    // Track loading promises to prevent duplicate loads
    loadingPromises: {}
};

// ============================================================================
// Initialization
// ============================================================================

NextStepButton.initialize = function() {
    const self = this;
    
    this.state.$button = document.getElementById("NextStep");
    
    if (!this.state.$button) {
        console.error("NextStep button not found");
        return;
    }
    
    this.state.$button.addEventListener("click", async function() {
        if (self.state.$button.classList.contains("btn-loading")) return;
        
        try {
            ButtonBase.setButtonLoading(self.state.$button, true, "Processing...", "Next Step");
            await self.execute();
        } catch (error) {
            console.error("Error in NextStep:", error);
            await ButtonBase.showAlert("An unexpected error occurred. Please try again.");
        } finally {
            ButtonBase.setButtonLoading(self.state.$button, false, "Processing...", "Next Step");
        }
    });
    
    console.log("Next Step button initialized");
    
    // Preload LOB script in background
    this.preloadLOBScript();
};

NextStepButton.preloadLOBScript = async function() {
    try {
        // Load base form data to get LOB
        this.loadBaseFormData();
        
        const lobKey = this.getLOBKey();
        if (lobKey) {
            await this.loadLOBScript(lobKey);
            console.log("LOB script preloaded:", lobKey);
        }
    } catch (error) {
        // Silently fail - will retry on click
        console.log("LOB preload skipped:", error.message);
    }
};

// ============================================================================
// UI Helper Functions
// ============================================================================

NextStepButton.showError = function(message) {
    ButtonBase.showError(message, "NEXTSTEP_ERROR");
};

NextStepButton.clearError = function() {
    ButtonBase.clearError("NEXTSTEP_ERROR");
};

// ============================================================================
// Data Loading - Base
// ============================================================================

NextStepButton.loadBaseFormData = function() {
    const formContext = ButtonBase.getFormContext();
    const state = this.state;
    
    state.request.id = ButtonBase.cleanGuid(formContext.data.entity.getId());
    state.request.lob = ButtonBase.getLookupValue("vhacrm_lobid");
    state.request.veteran = ButtonBase.getLookupValue("customerid");
    state.request.type = ButtonBase.getLookupValue("vhacrm_typeintersectionid");
    state.request.area = ButtonBase.getLookupValue("vhacrm_areaintersectionid");
    state.request.subArea = ButtonBase.getLookupValue("vhacrm_subareaintersectionid");
    state.request.facility = ButtonBase.getLookupValue("vhacrm_facilityid");
    state.request.action = ButtonBase.getLookupValue("vhacrm_actionintersectionid");
    state.request.caseNoteMemo = ButtonBase.getAttributeValue("vhacrm_casenotes_memo");
    state.request.caseNoteTemplate = ButtonBase.getLookupValue("vhacrm_casenotetemplateid");
    
    // Get LOB name for routing
    if (state.request.lob) {
        state.request.lobName = state.request.lob.name;
    }
};

NextStepButton.checkCaseNoteExists = async function() {
    const requestId = this.state.request.id;
    const ownerId = ButtonBase.getCurrentUserId();
    
    try {
        const result = await ButtonBase.retrieveMultipleRecords(
            "vhacrm_casenote",
            `?$select=vhacrm_name&$top=1&$filter=_vhacrm_requestid_value eq '${requestId}' and _createdby_value eq '${ownerId}'`
        );
        this.state.flags.caseNoteExists = result.entities.length > 0;
    } catch (error) {
        console.error("Error checking case note existence:", error);
        this.state.flags.caseNoteExists = false;
    }
};

// ============================================================================
// Validation - Base
// ============================================================================

NextStepButton.runBaseValidations = function() {
    const errors = [];
    const state = this.state;
    
    // Type is required
    if (!state.request.type) {
        errors.push("Type is required to process next step.");
    }
    
    // Area is required
    if (!state.request.area) {
        errors.push("Area is required to process next step.");
    }
    
    // Facility is required
    if (!state.request.facility) {
        errors.push("Facility is required to process next step.");
    }
    
    // Veteran is required
    if (!state.request.veteran) {
        errors.push("Veteran is required to process next step.");
    }
    
    // Case Note is required (memo OR existing)
    if (!state.request.caseNoteMemo && !state.flags.caseNoteExists) {
        errors.push("Please enter a Case Note before proceeding with action.");
    }
    
    return errors;
};

// ============================================================================
// Business Logic - Common
// ============================================================================

NextStepButton.buildCaseNoteName = function() {
    const parts = [];
    
    this.config.caseNoteNameFields.forEach((fieldName) => {
        const lookup = ButtonBase.getLookupValue(fieldName);
        if (lookup?.name) {
            parts.push(lookup.name);
        }
    });
    
    return parts.join("/");
};

NextStepButton.createCaseNote = async function() {
    if (!this.state.request.caseNoteMemo) return;
    if (!this.state.request.veteran) return;
    
    const caseNote = {
        vhacrm_name: this.buildCaseNoteName(),
        vhacrm_casenotes_memo: this.state.request.caseNoteMemo,
        "vhacrm_requestid@odata.bind": `/incidents(${this.state.request.id})`,
        "vhacrm_veteranid@odata.bind": `/contacts(${ButtonBase.cleanGuid(this.state.request.veteran.id)})`,
        vhacrm_casenotetype_code: this.config.caseNote.caseNoteTypeCode
    };
    
    if (this.state.request.caseNoteTemplate) {
        caseNote["vhacrm_casenotetemplateid@odata.bind"] = 
            `/vhacrm_casenotetemplates(${ButtonBase.cleanGuid(this.state.request.caseNoteTemplate.id)})`;
    }
    
    try {
        await ButtonBase.createRecord(this.config.caseNote.entityName, caseNote);
        console.log("Case note created successfully");
    } catch (error) {
        console.error("Error creating case note:", error);
        throw new Error("Failed to create case note.");
    }
};

NextStepButton.triggerNextAction = function() {
    ButtonBase.setAttributeValue("vhacrm_onpccnextactionbutton", true);
};

// ============================================================================
// LOB Handler Resolution & Dynamic Loading
// ============================================================================

NextStepButton.getLOBKey = function() {
    const lobName = this.state.request.lobName;
    if (!lobName) return null;
    
    const lobNameLower = lobName.toLowerCase();
    
    // Try exact match first
    if (this.lobScriptMap[lobNameLower]) {
        return lobNameLower;
    }
    
    // Try partial match (e.g., "PCC" matches "PCC - Something")
    for (const key of Object.keys(this.lobScriptMap)) {
        if (lobNameLower.includes(key) || key.includes(lobNameLower)) {
            return key;
        }
    }
    
    return null;
};

NextStepButton.loadLOBScript = function(lobKey) {
    // If already loading, return existing promise
    if (this.state.loadingPromises[lobKey]) {
        console.log(`LOB script already loading: ${lobKey}`);
        return this.state.loadingPromises[lobKey];
    }
    
    // If already loaded, return resolved promise
    if (this.lobHandlers[lobKey]) {
        console.log(`LOB handler already loaded: ${lobKey}`);
        return Promise.resolve(this.lobHandlers[lobKey]);
    }
    
    const scriptFile = this.lobScriptMap[lobKey];
    if (!scriptFile) {
        return Promise.reject(new Error(`No script file mapped for LOB: ${lobKey}`));
    }
    
    console.log(`Loading LOB script: ${scriptFile}`);
    
    // Create and track the loading promise
    this.state.loadingPromises[lobKey] = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = scriptFile;
        script.async = false;
        
        script.onload = () => {
            console.log(`LOB script loaded: ${scriptFile}`);
            // Give a brief moment for the script to execute and register
            setTimeout(() => {
                delete this.state.loadingPromises[lobKey]; // Clear loading state
                if (this.lobHandlers[lobKey]) {
                    resolve(this.lobHandlers[lobKey]);
                } else {
                    reject(new Error(`LOB handler did not register after loading: ${lobKey}`));
                }
            }, 10);
        };
        
        script.onerror = () => {
            delete this.state.loadingPromises[lobKey]; // Clear loading state
            reject(new Error(`Failed to load LOB script: ${scriptFile}`));
        };
        
        document.head.appendChild(script);
    });
    
    return this.state.loadingPromises[lobKey];
};

NextStepButton.getLOBHandler = function() {
    const lobKey = this.getLOBKey();
    if (!lobKey) return null;
    return this.lobHandlers[lobKey] || null;
};

// ============================================================================
// Main Execution Flow
// ============================================================================

NextStepButton.execute = async function() {
    this.clearError();
    
    // Pre-validation: Action required
    if (!ButtonBase.getLookupValue("vhacrm_actionintersectionid")) {
        await ButtonBase.showAlert("Please select an Action before continuing.", "Missing Action");
        return;
    }
    
    // Pre-validation: Owner check
    if (!ButtonBase.isCurrentUserOwner()) {
        await ButtonBase.showAlert("You must pick the request from the queue before proceeding.", "Incorrect Request Owner");
        return;
    }
    
    // Load base form data (includes LOB)
    this.loadBaseFormData();
    
    // Determine LOB key
    const lobKey = this.getLOBKey();
    
    if (!lobKey) {
        this.showError(`No handler configured for LOB: ${this.state.request.lobName || "Unknown"}`);
        return;
    }
    
    // Dynamically load LOB script if not already loaded
    let lobHandler;
    try {
        lobHandler = await this.loadLOBScript(lobKey);
    } catch (error) {
        console.error("Error loading LOB script:", error);
        this.showError(`Failed to load handler for LOB: ${this.state.request.lobName}`);
        return;
    }
    
    // Store current LOB handler reference
    this.state.currentLOB = lobHandler;
    
    // Delegate to LOB handler for specific processing
    try {
        await lobHandler.execute(this);
    } catch (error) {
        console.error(`Error in ${this.state.request.lobName} handler:`, error);
        await ButtonBase.showAlert(error.message || "An error occurred while processing the next step.");
    }
};
