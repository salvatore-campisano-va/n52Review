# Unified Complete Request Button

## Overview

The **Unified Complete Request Button** is a modular JavaScript architecture for handling the "Complete Request" action across multiple Lines of Business (LOBs) in the Dynamics CRM web resource. Instead of maintaining separate button implementations for each LOB, this unified approach uses a base module with dynamically loaded LOB-specific handlers.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CompleteRequestButton.html                    │
│                        (Single HTML Web Resource)                    │
├─────────────────────────────────────────────────────────────────────┤
│                          ButtonBase.js                               │
│                    (Shared Utilities Library)                        │
├─────────────────────────────────────────────────────────────────────┤
│                      CompleteRequestButton.js                        │
│                     (Base Module - Core Logic)                       │
│    ┌─────────────────────────────────────────────────────────────┐  │
│    │  lobScriptMap:                                               │  │
│    │    "ivd"   → CompleteRequestButton_IVD.js                   │  │
│    │    "ncchv" → CompleteRequestButton_NCCHV.js                 │  │
│    │    "eed"   → CompleteRequestButton_EED.js                   │  │
│    │    "hd"    → CompleteRequestButton_HD.js                    │  │
│    └─────────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│                      LOB Handler (Dynamic Load)                      │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐       │
│  │    IVD     │ │   NCCHV    │ │    EED     │ │     HD     │       │
│  │  Handler   │ │  Handler   │ │  Handler   │ │  Handler   │       │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘       │
└─────────────────────────────────────────────────────────────────────┘
```

## File Structure

```
UnifiedCompleteRequestButton/
├── CompleteRequestButton.html      # HTML web resource
├── CompleteRequestButton.js        # Base module (core logic)
├── CompleteRequestButton_IVD.js    # IVD LOB handler
├── CompleteRequestButton_NCCHV.js  # NCCHV LOB handler
├── CompleteRequestButton_EED.js    # EED LOB handler
├── CompleteRequestButton_HD.js     # HD LOB handler
└── CompleteRequestButton.md        # This documentation
```

## Supported Lines of Business

| LOB Key | LOB Name | Handler File | Workflow |
|---------|----------|--------------|----------|
| `ivd` | IVD | CompleteRequestButton_IVD.js | EED-Request Complete Request |
| `ncchv` | NCCHV | CompleteRequestButton_NCCHV.js | NCCHV-Request Deactivate NCCHV Request |
| `eed` | EED | CompleteRequestButton_EED.js | EED-Request Complete Request |
| `hd` | HD (Help Desk) | CompleteRequestButton_HD.js | Request - HD Route/Complete Request |

## Base Module (CompleteRequestButton.js)

### Configuration

```javascript
CompleteRequestButton.config = {
    workflows: {
        deactivate: "579F4A5D-E67E-404E-AA3A-896C3D5392FC",  // Request - Deactivate
        completeRequest: "68E7DAE8-93A7-4F73-AFB4-77C565E211CE"  // EED-Request Complete Request
    },
    resolutions: {
        createdInError: "Created in Error",
        pendingFutureRAD: "Pending Future RAD"
    },
    hecAlertCompletedStatusCode: 713770006
};
```

### LOB Script Map

```javascript
CompleteRequestButton.lobScriptMap = {
    "ivd": "CompleteRequestButton_IVD.js",
    "ncchv": "CompleteRequestButton_NCCHV.js",
    "eed": "CompleteRequestButton_EED.js",
    "hd": "CompleteRequestButton_HD.js"
};
```

### Execution Flow

1. **Pre-Validation**
   - Check Resolution is provided
   - Check current user is the owner

2. **Load Base Form Data**
   - Request ID, LOB, Veteran, Resolution, HEC Alert

3. **Determine LOB Key**
   - Map LOB name to handler key (case-insensitive, partial match supported)

4. **Dynamic Script Loading**
   - Load LOB-specific handler script if not already loaded
   - Scripts self-register via `CompleteRequestButton.registerLOB()`

5. **Load Resolution Name**
   - Retrieve resolution name from server
   - Set `isCreatedInError` and `isPendingFutureRAD` flags

6. **Handle "Created in Error"**
   - If resolution is "Created in Error", execute deactivate workflow and close

7. **Delegate to LOB Handler**
   - Call `lobHandler.execute(base)` for LOB-specific processing

### Key Functions

| Function | Description |
|----------|-------------|
| `initialize()` | Set up button click handler, preload LOB script |
| `loadBaseFormData()` | Load common form fields into state |
| `loadResolutionName()` | Retrieve resolution name, set flags |
| `getLOBKey()` | Map LOB name to handler key |
| `loadLOBScript(lobKey)` | Dynamically load LOB handler script |
| `registerLOB(name, handler)` | Register LOB handler (called by LOB scripts) |
| `updateHecAlert()` | Update linked HEC Alert to completed status |
| `execute()` | Main execution entry point |

## LOB Handler Pattern

Each LOB handler follows the IIFE (Immediately Invoked Function Expression) pattern with self-registration:

```javascript
(function() {
    var Handler = {
        name: "LOB_NAME",
        
        config: {
            // LOB-specific configuration
        },
        
        state: {
            // LOB-specific state
        },
        
        loadFormData: function(base) {
            // Load LOB-specific form fields
        },
        
        runValidations: function(base) {
            // Return array of validation error messages
            return [];
        },
        
        execute: async function(base) {
            // Main LOB execution logic
            // Access base state via base.state
            // Access ButtonBase utilities via ButtonBase.*
        }
    };
    
    // Self-registration
    CompleteRequestButton.registerLOB("LOB_NAME", Handler);
})();
```

### Handler Interface

| Property/Method | Required | Description |
|-----------------|----------|-------------|
| `name` | Yes | Handler identifier |
| `config` | No | LOB-specific configuration |
| `state` | No | LOB-specific state tracking |
| `loadFormData(base)` | No | Load LOB-specific form fields |
| `runValidations(base)` | No | Return array of error messages |
| `execute(base)` | Yes | Main execution entry point |

### Accessing Base Module

LOB handlers receive the base module reference as the `base` parameter:

```javascript
execute: async function(base) {
    // Access base state
    const requestId = base.state.request.id;
    const isCreatedInError = base.state.flags.isCreatedInError;
    
    // Access base config
    const deactivateWorkflow = base.config.workflows.deactivate;
    
    // Call base methods
    base.showError("Validation failed");
    await base.updateHecAlert();
}
```

### Accessing ButtonBase Utilities

LOB handlers use ButtonBase directly for common operations:

```javascript
// Form context
const formContext = ButtonBase.getFormContext();

// Field access
const veteran = ButtonBase.getLookupValue("customerid");
const memo = ButtonBase.getAttributeValue("vhacrm_casenotes_memo");

// CRUD operations
await ButtonBase.createRecord("vhacrm_casenote", data);
await ButtonBase.updateRecord("incident", id, updates);
const result = await ButtonBase.retrieveMultipleRecords("vhacrm_casenote", query);

// Workflow
await ButtonBase.executeWorkflow(workflowId, recordId);

// UI
await ButtonBase.saveForm();
ButtonBase.closeForm();
```

## LOB Handler Details

### HD Handler

**Purpose:** Complete Help Desk requests

**Configuration:**
```javascript
config: {
    caseNoteTypeCode: 168790000,
    completeWorkflowId: "F9A56996-0EA6-4029-95C5-06A67315EED9",
    hdLobId: "1bd4b15a-bfbb-e511-9414-0050568dc724"
}
```

**Validations:**
- Case Note required (memo OR existing today)

**Execution:**
1. Load HD-specific form data (type, area, subArea, memo, template)
2. Check if case note exists today by current user
3. Run validations
4. Create case note if memo provided
5. Save form
6. Execute HD workflow (only if LOB matches HD GUID)
7. Close form

**Note:** HD handler does NOT update HEC Alert (not applicable for HD).

### EED Handler

**Purpose:** Complete EED (Enrollment Eligibility Division) requests

**Configuration:**
```javascript
config: {
    caseNoteTypeCode: 168790000,
    placeholderVeteranId: "1b8680e1-8d87-e611-9422-0050568dade6"
}
```

**Validations:**
- Veteran required (unless placeholder veteran)
- Verification Method required (unless placeholder veteran)
- Contact Method required (unless no contact required OR placeholder veteran)
- RAD Date required (if Pending Future RAD)
- Reevaluate Date required (if Pending Future RAD)
- Case Note required (memo OR existing today)

**Execution:**
1. Load EED-specific form data
2. Load activity counts (correspondence, phone calls)
3. Check if case note exists today
4. Run validations
5. Create case note
6. Update incident case note fields
7. Update incident with record URL
8. Update HEC Alert
9. Save form
10. Execute complete workflow
11. Close form

### IVD Handler

**Purpose:** Complete IVD requests

**Validations:**
- (Inherits base validations)
- Case Note required

**Execution:**
- Similar to EED with IVD-specific fields

### NCCHV Handler

**Purpose:** Complete NCCHV requests

**Configuration:**
```javascript
config: {
    workflows: {
        deactivateNCCHV: "27C9DD00-A7FF-EE11-8179-00155D011E3E"
    }
}
```

**Validations:**
- (NCCHV-specific validations)

**Execution:**
- Uses NCCHV-specific deactivate workflow

## Adding a New LOB

To add support for a new LOB:

1. **Create Handler File**
   
   Create `CompleteRequestButton_NEWLOB.js`:
   
   ```javascript
   (function() {
       var NEWLOBHandler = {
           name: "NEWLOB",
           
           config: {
               // LOB-specific config
           },
           
           state: {
               // LOB-specific state
           },
           
           execute: async function(base) {
               // Implementation
           }
       };
       
       CompleteRequestButton.registerLOB("NEWLOB", NEWLOBHandler);
   })();
   ```

2. **Register in lobScriptMap**
   
   In `CompleteRequestButton.js`:
   
   ```javascript
   CompleteRequestButton.lobScriptMap = {
       // ... existing entries
       "newlob": "CompleteRequestButton_NEWLOB.js"
   };
   ```

3. **Deploy Web Resource**
   
   Upload the new handler file as a web resource in the same folder.

## Dependencies

- **ButtonBase.js** - Shared utilities (must be loaded before CompleteRequestButton.js)
- **Xrm Context** - Dynamics CRM JavaScript API (parent.Xrm)

## HTML Structure

The HTML file loads scripts in this order:

```html
<script src="ButtonBase.js"></script>
<script src="CompleteRequestButton.js"></script>
```

LOB handler scripts are loaded dynamically when needed, reducing initial page load time.

## Error Handling

- Validation errors display via form notification
- Script loading failures show alert to user
- All async operations wrapped in try/catch
- Console logging for debugging

## Testing Considerations

1. **LOB Routing** - Verify correct handler loads for each LOB
2. **Dynamic Loading** - Test first-time vs. cached script loading
3. **Validation** - Test all LOB-specific validation rules
4. **Workflow Execution** - Verify correct workflow triggers
5. **Edge Cases** - Test "Created in Error", missing LOB, placeholder veteran