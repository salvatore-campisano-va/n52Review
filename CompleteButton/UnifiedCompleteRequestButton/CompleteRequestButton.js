/**
 * Complete Request Button - Base Module
 * Contains shared functionality for all LOBs
 * Extends ButtonBase for common utilities
 */
"use strict";

var CompleteRequestButton = CompleteRequestButton || {};

// ============================================================================
// LOB Registry - LOB modules register themselves here
// ============================================================================

CompleteRequestButton.lobHandlers = {};

// Map LOB names to script files
CompleteRequestButton.lobScriptMap = {
    "ivd": "CompleteRequestButton_IVD.js",
    "ncchv": "CompleteRequestButton_NCCHV.js",
    "eed": "CompleteRequestButton_EED.js",
    "hd": "CompleteRequestButton_HD.js"
};

CompleteRequestButton.registerLOB = function(lobName, handler) {
    this.lobHandlers[lobName.toLowerCase()] = handler;
    console.log(`LOB handler registered: ${lobName}`);
};

// ============================================================================
// Configuration - Base config, LOBs extend this
// ============================================================================

CompleteRequestButton.config = {
    // Common workflow IDs
    workflows: {
        // Workflow: Request - Deactivate
        deactivate: "579F4A5D-E67E-404E-AA3A-896C3D5392FC",
        // EED-Request Complete Request
        // (IVD also uses this one)
        completeRequest: "68E7DAE8-93A7-4F73-AFB4-77C565E211CE"
    },
    
    // Common resolution names
    resolutions: {
        createdInError: "Created in Error",
        pendingFutureRAD: "Pending Future RAD"
    },
    
    // HEC Alert completed status
    hecAlertCompletedStatusCode: 713770006
};

// ============================================================================
// State - Base state, LOBs extend this
// ============================================================================

CompleteRequestButton.state = {
    $button: null,
    currentLOB: null,
    
    request: {
        id: null,
        lob: null,
        lobName: null,
        veteran: null,
        resolution: null,
        resolutionName: null,
        hecAlert: null
    },
    
    flags: {
        isCreatedInError: false,
        isPendingFutureRAD: false
    },
    
    // Track loading promises to prevent duplicate loads
    loadingPromises: {}
};

// ============================================================================
// Initialization
// ============================================================================

CompleteRequestButton.initialize = function() {
    const self = this;
    
    this.state.$button = document.getElementById("CompleteRequest");
    
    if (!this.state.$button) {
        console.error("CompleteRequest button not found");
        return;
    }
    
    this.state.$button.addEventListener("click", async function() {
        if (self.state.$button.disabled) return;
        
        try {
            ButtonBase.setButtonLoading(self.state.$button, true, "Processing...", "Complete Request");
            await self.execute();
        } catch (error) {
            console.error("Error in CompleteRequest:", error);
            await ButtonBase.showAlert("An unexpected error occurred. Please try again.");
        } finally {
            ButtonBase.setButtonLoading(self.state.$button, false, "Processing...", "Complete Request");
        }
    });
    
    console.log("Complete Request button initialized");
    
    // Preload LOB script in background
    this.preloadLOBScript();
};

CompleteRequestButton.preloadLOBScript = async function() {
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

CompleteRequestButton.showError = function(message) {
    ButtonBase.showError(message, "COMPLETE_ERROR");
};

CompleteRequestButton.clearError = function() {
    ButtonBase.clearError("COMPLETE_ERROR");
};

// ============================================================================
// Data Loading - Base
// ============================================================================

CompleteRequestButton.loadBaseFormData = function() {
    const formContext = ButtonBase.getFormContext();
    const state = this.state;
    
    state.request.id = ButtonBase.cleanGuid(formContext.data.entity.getId());
    state.request.lob = ButtonBase.getLookupValue("vhacrm_lobid");
    state.request.veteran = ButtonBase.getLookupValue("customerid");
    state.request.resolution = ButtonBase.getLookupValue("vhacrm_resolutionintersectionid");
    state.request.hecAlert = ButtonBase.getLookupValue("vhacrm_hecalertid");
    
    // Get LOB name for routing
    if (state.request.lob) {
        state.request.lobName = state.request.lob.name;
    }
};

CompleteRequestButton.loadResolutionName = async function() {
    const resolution = this.state.request.resolution;
    if (!resolution) return;
    
    try {
        const result = await ButtonBase.retrieveRecord(
            "vhacrm_resolutionintersection",
            resolution.id,
            "?$select=vhacrm_name"
        );
        
        this.state.request.resolutionName = result.vhacrm_name;
        
        // Set resolution flags
        const name = result.vhacrm_name;
        this.state.flags.isCreatedInError = name === this.config.resolutions.createdInError;
        this.state.flags.isPendingFutureRAD = name === this.config.resolutions.pendingFutureRAD;
        
    } catch (error) {
        console.error("Error loading resolution name:", error);
    }
};

// ============================================================================
// Validation - Base
// ============================================================================

CompleteRequestButton.runBaseValidations = function() {
    const errors = [];
    
    // Skip validations for Created in Error
    if (this.state.flags.isCreatedInError) {
        return errors;
    }
    
    // Veteran is required (base validation - LOBs can override)
    if (!this.state.request.veteran) {
        errors.push("Veteran is required to complete the request.");
    }
    
    return errors;
};

// ============================================================================
// Business Logic - Common
// ============================================================================

CompleteRequestButton.updateHecAlert = async function() {
    if (!this.state.request.hecAlert) return;
    
    try {
        await ButtonBase.updateRecord(
            "vhacrm_hecalert",
            this.state.request.hecAlert.id,
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

// ============================================================================
// Shared LOB Utilities
// ============================================================================

/**
 * Load common form fields used by multiple LOBs
 * @returns {Object} Object containing type, area, subArea, caseNoteMemo, caseNoteTemplate
 */
CompleteRequestButton.loadCommonFormFields = function() {
    return {
        type: ButtonBase.getLookupValue("vhacrm_typeintersectionid"),
        area: ButtonBase.getLookupValue("vhacrm_areaintersectionid"),
        subArea: ButtonBase.getLookupValue("vhacrm_subareaintersectionid"),
        caseNoteMemo: ButtonBase.getAttributeValue("vhacrm_casenotes_memo"),
        caseNoteTemplate: ButtonBase.getLookupValue("vhacrm_casenotetemplateid")
    };
};

/**
 * Check if a case note exists today created by the current user
 * @param {string} requestId - The request ID
 * @returns {Promise<boolean>} True if case note exists today
 */
CompleteRequestButton.checkCaseNoteExistsToday = async function(requestId) {
    const ownerId = ButtonBase.getCurrentUserId();
    const todayRange = ButtonBase.getTodayRange();
    
    try {
        const result = await ButtonBase.retrieveMultipleRecords(
            "vhacrm_casenote",
            `?$select=vhacrm_casenoteid&$top=1&$filter=_vhacrm_requestid_value eq '${requestId}' and _createdby_value eq '${ownerId}' and createdon ge ${todayRange.start.toISOString()} and createdon le ${todayRange.end.toISOString()}`
        );
        return result.entities.length > 0;
    } catch (error) {
        console.error("Error checking case note existence:", error);
        return false;
    }
};

/**
 * Build case note name from LOB/Type/Area/SubArea
 * @param {Object} lob - LOB lookup value
 * @param {Object} type - Type lookup value
 * @param {Object} area - Area lookup value
 * @param {Object} subArea - SubArea lookup value
 * @returns {string} Formatted case note name
 */
CompleteRequestButton.buildCaseNoteName = function(lob, type, area, subArea) {
    let name = "";
    
    if (lob) {
        name = lob.name;
    }
    
    if (type) {
        name += (name ? "/" : "") + type.name;
    }
    
    if (area) {
        name += (name ? "/" : "") + area.name;
    }
    
    if (subArea) {
        name += (name ? "/" : "") + subArea.name;
    }
    
    return name;
};

/**
 * Create a case note record
 * @param {Object} options - Case note options
 * @param {string} options.requestId - Request ID
 * @param {string} options.caseNoteName - Case note name
 * @param {string} options.caseNoteMemo - Case note memo content
 * @param {number} options.caseNoteTypeCode - Case note type code
 * @param {Object} [options.veteran] - Veteran lookup value
 * @param {Object} [options.hecAlert] - HEC Alert lookup value
 * @param {Object} [options.caseNoteTemplate] - Case note template lookup value
 * @returns {Promise<void>}
 */
CompleteRequestButton.createCaseNote = async function(options) {
    if (!options.caseNoteMemo) return;
    
    const caseNote = {
        vhacrm_name: options.caseNoteName,
        vhacrm_casenotes_memo: options.caseNoteMemo,
        "vhacrm_requestid@odata.bind": `/incidents(${options.requestId})`,
        vhacrm_casenotetype_code: options.caseNoteTypeCode
    };
    
    // Add veteran if present
    if (options.veteran) {
        caseNote["vhacrm_veteranid@odata.bind"] = `/contacts(${ButtonBase.cleanGuid(options.veteran.id)})`;
    }
    
    // Add HEC Alert if present
    if (options.hecAlert) {
        caseNote["vhacrm_hecalertid@odata.bind"] = `/vhacrm_hecalerts(${ButtonBase.cleanGuid(options.hecAlert.id)})`;
    }
    
    // Add template if present
    if (options.caseNoteTemplate) {
        caseNote["vhacrm_casenotetemplateid@odata.bind"] = 
            `/vhacrm_casenotetemplates(${ButtonBase.cleanGuid(options.caseNoteTemplate.id)})`;
    }
    
    try {
        await ButtonBase.createRecord("vhacrm_casenote", caseNote);
        console.log("Case note created successfully");
    } catch (error) {
        console.error("Error creating case note:", error);
        throw new Error("Failed to create case note.");
    }
};

/**
 * Update incident case note fields (clear memo and template)
 * @param {string} requestId - Request ID
 * @param {string} caseNoteMemo - Case note memo to store in hidden field
 * @returns {Promise<void>}
 */
CompleteRequestButton.updateIncidentCaseNoteFields = async function(requestId, caseNoteMemo) {
    try {
        await ButtonBase.updateRecord("incident", requestId, {
            vhacrm_casenotehidden: caseNoteMemo,
            "vhacrm_casenotetemplateid@odata.bind": null
        });
        console.log("Incident case note fields updated");
    } catch (error) {
        console.error("Error updating incident case note fields:", error);
    }
};

/**
 * Update incident with record URL
 * @param {string} requestId - Request ID
 * @returns {Promise<void>}
 */
CompleteRequestButton.setRecordUrl = async function(requestId) {
    try {
        const baseUrl = await ButtonBase.getKeyValuePair("base_url");
        
        if (!baseUrl) {
            console.warn("Base URL not found in key value pairs");
            return;
        }
        
        const recordUrl = `${baseUrl}/main.aspx?etn=incident&id=${requestId}&pagetype=entityrecord`;
        
        await ButtonBase.updateRecord("incident", requestId, {
            vhacrm_recordurl_memo: recordUrl
        });
        
        console.log("Record URL updated");
    } catch (error) {
        console.error("Error updating record URL:", error);
    }
};

/**
 * Validate that a case note exists (either memo or created today)
 * @param {string} caseNoteMemo - Case note memo
 * @param {boolean} caseNoteExistsToday - Whether case note exists today
 * @returns {string|null} Error message or null if valid
 */
CompleteRequestButton.validateCaseNoteRequired = function(caseNoteMemo, caseNoteExistsToday) {
    if (!caseNoteMemo && !caseNoteExistsToday) {
        return "A completed Case Note is required to complete the request.";
    }
    return null;
};

// ============================================================================
// LOB Handler Resolution & Dynamic Loading
// ============================================================================

CompleteRequestButton.getLOBKey = function() {
    const lobName = this.state.request.lobName;
    if (!lobName) return null;
    
    const lobNameLower = lobName.toLowerCase();
    
    // Try exact match first
    if (this.lobScriptMap[lobNameLower]) {
        return lobNameLower;
    }
    
    // Try partial match (e.g., "IVD" matches "IVD - Something")
    for (const key of Object.keys(this.lobScriptMap)) {
        if (lobNameLower.includes(key) || key.includes(lobNameLower)) {
            return key;
        }
    }
    
    return null;
};

CompleteRequestButton.loadLOBScript = function(lobKey) {
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

CompleteRequestButton.getLOBHandler = function() {
    const lobKey = this.getLOBKey();
    if (!lobKey) return null;
    return this.lobHandlers[lobKey] || null;
};

// ============================================================================
// Main Execution Flow
// ============================================================================

CompleteRequestButton.execute = async function() {
    this.clearError();
    
    // Pre-validation: Resolution required
    if (!ButtonBase.getLookupValue("vhacrm_resolutionintersectionid")) {
        this.showError("A Resolution must be provided before completing the request.");
        return;
    }
    
    // Pre-validation: Owner check
    if (!ButtonBase.isCurrentUserOwner()) {
        this.showError("You must pick the request from the queue before completing the request.");
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
    
    // Load resolution name
    await this.loadResolutionName();
    
    // Handle "Created in Error" - common handling
    if (this.state.flags.isCreatedInError) {
        try {
            await ButtonBase.executeWorkflow(this.config.workflows.deactivate, this.state.request.id);
            await ButtonBase.saveAndClose();
        } catch (error) {
            console.error("Error handling Created in Error:", error);
            this.showError("An error occurred while processing the request.");
        }
        return;
    }
    
    // Delegate to LOB handler for specific processing
    try {
        await lobHandler.execute(this);
    } catch (error) {
        console.error(`Error in ${this.state.request.lobName} handler:`, error);
        this.showError(error.message || "An error occurred while completing the request.");
    }
};
