# Button Architecture

This document describes the layered architecture used for button web resources in Dynamics CRM.

## Overview

The button system uses a three-layer architecture:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              HTML Web Resource                               │
│                         (CompleteRequestButton.html)                         │
│                                                                              │
│   ┌─────────────┐    ┌─────────────────────┐    ┌─────────────────────┐    │
│   │  ButtonBase │ ←─ │ CompleteRequestButton│ ←─ │   LOB Handler       │    │
│   │    (js)     │    │       (js)           │    │ (IVD/NCCHV/EED)    │    │
│   └─────────────┘    └─────────────────────┘    └─────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Layer Details

### Layer 1: ButtonBase.js (Shared Utilities)

The foundation layer containing utilities shared across **all** button types.

```
┌──────────────────────────────────────────────────────────────────┐
│                          ButtonBase.js                            │
├──────────────────────────────────────────────────────────────────┤
│  Context Access                                                   │
│  ├── getXrm()                                                    │
│  ├── getFormContext()                                            │
│  └── getGlobalContext()                                          │
├──────────────────────────────────────────────────────────────────┤
│  Utilities                                                        │
│  ├── cleanGuid()                                                 │
│  ├── getCurrentUserId()                                          │
│  ├── getLookupValue()                                            │
│  ├── getAttributeValue()                                         │
│  └── setAttributeValue()                                         │
├──────────────────────────────────────────────────────────────────┤
│  UI Helpers                                                       │
│  ├── showError() / clearError()                                  │
│  ├── showAlert() / showConfirm()                                 │
│  └── setButtonLoading()                                          │
├──────────────────────────────────────────────────────────────────┤
│  API Helpers                                                      │
│  ├── retrieveRecord() / retrieveMultipleRecords()                │
│  ├── createRecord() / updateRecord() / deleteRecord()            │
│  ├── executeWorkflow()                                           │
│  └── getKeyValuePair()                                           │
├──────────────────────────────────────────────────────────────────┤
│  Form Operations                                                  │
│  ├── saveForm() / saveAndClose()                                 │
│  ├── closeForm() / refreshForm()                                 │
│  └── isCurrentUserOwner()                                        │
├──────────────────────────────────────────────────────────────────┤
│  Date Helpers                                                     │
│  ├── getTodayRange()                                             │
│  └── formatDateForOData()                                        │
└──────────────────────────────────────────────────────────────────┘
```

### Layer 2: Button Module (e.g., CompleteRequestButton.js)

The button-specific layer containing logic for a particular button type.

```
┌──────────────────────────────────────────────────────────────────┐
│                     CompleteRequestButton.js                      │
├──────────────────────────────────────────────────────────────────┤
│  LOB Registry                                                     │
│  ├── lobHandlers = {}                                            │
│  ├── lobScriptMap = { "ivd": "..._IVD.js", ... }                │
│  └── registerLOB(name, handler)                                  │
├──────────────────────────────────────────────────────────────────┤
│  Configuration                                                    │
│  ├── config.workflows.deactivate                                 │
│  ├── config.workflows.completeRequest                            │
│  └── config.resolutions                                          │
├──────────────────────────────────────────────────────────────────┤
│  State                                                            │
│  ├── state.request (id, lob, veteran, resolution, etc.)          │
│  └── state.flags (isCreatedInError, isPendingFutureRAD)          │
├──────────────────────────────────────────────────────────────────┤
│  Initialization                                                   │
│  ├── initialize()                                                │
│  └── preloadLOBScript()                                          │
├──────────────────────────────────────────────────────────────────┤
│  Button-Specific Logic                                            │
│  ├── loadBaseFormData()                                          │
│  ├── loadResolutionName()                                        │
│  ├── runBaseValidations()                                        │
│  └── updateHecAlert()                                            │
├──────────────────────────────────────────────────────────────────┤
│  LOB Dynamic Loading                                              │
│  ├── getLOBKey()                                                 │
│  ├── loadLOBScript()                                             │
│  └── getLOBHandler()                                             │
├──────────────────────────────────────────────────────────────────┤
│  Main Execution                                                   │
│  └── execute() → delegates to LOB handler                        │
└──────────────────────────────────────────────────────────────────┘
```

### Layer 3: LOB Handlers (e.g., CompleteRequestButton_IVD.js)

Line-of-Business specific logic that extends the button module.

```
┌──────────────────────────────────────────────────────────────────┐
│                  LOB Handler (IVD/NCCHV/EED)                      │
├──────────────────────────────────────────────────────────────────┤
│  Registration                                                     │
│  └── CompleteRequestButton.registerLOB("IVD", handler)           │
├──────────────────────────────────────────────────────────────────┤
│  LOB-Specific Config                                              │
│  └── config.workflowId, config.caseNoteTypeCode, etc.            │
├──────────────────────────────────────────────────────────────────┤
│  LOB-Specific State                                               │
│  └── state.verificationMethod, state.radDate, etc.               │
├──────────────────────────────────────────────────────────────────┤
│  LOB-Specific Logic                                               │
│  ├── loadFormData()                                              │
│  ├── runValidations()                                            │
│  ├── createCaseNote()                                            │
│  └── other LOB-specific operations                               │
├──────────────────────────────────────────────────────────────────┤
│  Main Execution                                                   │
│  └── execute(base) → called by CompleteRequestButton             │
└──────────────────────────────────────────────────────────────────┘
```

## Data Flow

```
User Click
    │
    ▼
┌─────────────────────────────────────┐
│     CompleteRequestButton.js        │
│     ────────────────────────        │
│  1. Validate resolution exists      │
│  2. Validate user is owner          │
│  3. Load base form data             │
│  4. Determine LOB key               │
│  5. Load LOB script (dynamic)       │
│  6. Load resolution name            │
│  7. Handle "Created in Error"       │
│     OR delegate to LOB handler      │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│        LOB Handler (e.g., IVD)      │
│        ───────────────────────      │
│  1. Load LOB-specific form data     │
│  2. Load additional data (async)    │
│  3. Run LOB validations             │
│  4. Execute LOB-specific logic      │
│     - Create case notes             │
│     - Update records                │
│     - Call APIs                     │
│  5. Update HEC Alert (base)         │
│  6. Execute workflow                │
│  7. Save and close                  │
└─────────────────────────────────────┘
```

## File Structure

```
n52 Review/
├── Shared/
│   ├── ButtonBase.js              ← Shared utilities (all buttons)
│   └── ButtonArchitecture.md      ← This file
│
├── CompleteButton/
│   └── UnifiedCompleteRequestButton/
│       ├── CompleteRequestButton.html     ← HTML entry point
│       ├── CompleteRequestButton.js       ← Base module
│       ├── CompleteRequestButton_IVD.js   ← IVD handler
│       ├── CompleteRequestButton_NCCHV.js ← NCCHV handler
│       └── CompleteRequestButton_EED.js   ← EED handler
│
└── NextStepButton/
    └── UnifiedNextStepButton/
        ├── NextStepButton.html            ← HTML entry point
        └── NextStepButton.js              ← Uses ButtonBase
```

## Script Loading Order

```html
<!-- 1. Shared utilities (must load first) -->
<script src="ButtonBase.js"></script>

<!-- 2. Button module (depends on ButtonBase) -->
<script src="CompleteRequestButton.js"></script>

<!-- 3. LOB handlers loaded dynamically at runtime -->
<!-- Loaded via CompleteRequestButton.loadLOBScript() -->
```

## Adding a New LOB

1. Create `CompleteRequestButton_NEWLOB.js`:

```javascript
(function() {
    var NEWLOBHandler = {
        name: "NEWLOB",
        config: { /* LOB-specific config */ },
        state: { /* LOB-specific state */ },
        
        loadFormData: function(base) {
            // Load LOB-specific fields using ButtonBase
            this.state.field = ButtonBase.getAttributeValue("field_name");
        },
        
        runValidations: function(base) {
            const errors = base.runBaseValidations();
            // Add LOB-specific validations
            return errors;
        },
        
        execute: async function(base) {
            this.loadFormData(base);
            
            const errors = this.runValidations(base);
            if (errors.length > 0) {
                base.showError(errors.join(" | "));
                return;
            }
            
            // LOB-specific logic
            await base.updateHecAlert();
            await ButtonBase.executeWorkflow(workflowId, base.state.request.id);
            await ButtonBase.saveAndClose();
        }
    };
    
    CompleteRequestButton.registerLOB("NEWLOB", NEWLOBHandler);
})();
```

2. Add to `lobScriptMap` in CompleteRequestButton.js:

```javascript
CompleteRequestButton.lobScriptMap = {
    "ivd": "CompleteRequestButton_IVD.js",
    "ncchv": "CompleteRequestButton_NCCHV.js",
    "eed": "CompleteRequestButton_EED.js",
    "newlob": "CompleteRequestButton_NEWLOB.js"  // Add this
};
```

## Benefits

| Benefit | Description |
|---------|-------------|
| **Code Reuse** | ButtonBase utilities shared across all buttons |
| **Maintainability** | Fix bugs in one place, affects all buttons |
| **Scalability** | Add new LOBs without modifying base code |
| **Performance** | Dynamic loading - only loads needed LOB handler |
| **Consistency** | Standard patterns across all button implementations |
| **Testability** | Each layer can be tested independently |
