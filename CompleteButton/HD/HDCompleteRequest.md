# HD Complete Request Button - Business Logic Documentation

*All code is based on the current North52 code in Production. North52 code that is commented out in the formula was left out of this javascript.*

## Overview

The HD Complete Request button is an iframe-embedded button on the Request (Incident) form that validates and completes HD (Help Desk) requests. It performs validation checks, creates case notes, triggers workflows, and closes the form.

---

## Execution Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     User Clicks Button                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. Pre-Validation Checks                                       │
│     • Resolution must be set                                    │
│     • Current user must be the record owner                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. Load Form Data                                              │
│     • Read all form fields into state                           │
│     • Check if case note exists today                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. Run Validations                                             │
│     • Case note required (memo OR existing today)               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. Complete Request                                            │
│     • Create Case Note (if memo populated)                      │
│     • Save Form                                                 │
│     • Execute Complete Workflow (HD LOB only)                   │
│     • Close Form                                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Validation Rules

HD has a simpler validation set compared to other LOBs.

### Standard Validations

| Rule | Condition | Error Message |
|------|-----------|---------------|
| **Case Note Required** | Case Note Memo is empty AND no case note exists today by current user | "A completed case note is required to complete the request." |

---

## Processing Steps

### 1. Create Case Note
**Condition**: Case Note Memo is populated

Creates a `vhacrm_casenote` record with:

| Field | Value |
|-------|-------|
| `vhacrm_name` | Built from LOB/Type/Area/SubArea |
| `vhacrm_casenotes_memo` | From form case note memo field |
| `vhacrm_requestid` | Link to current request |
| `vhacrm_casenotetype_code` | `168790000` |
| `vhacrm_veteranid` | Link to veteran via `customerid` (if present) |
| `vhacrm_casenotetemplateid` | Link to template (if present) |

### 2. Save Form
- Saves the form so workflow can read latest values

### 3. Execute Workflow
**Condition**: LOB is HD (`1bd4b15a-bfbb-e511-9414-0050568dc724`)

- Executes **Request - HD Route/Complete Request** workflow

### 4. Close Form
- Navigates back or closes the form

---

## Workflows Used

| Purpose | Workflow Name | GUID |
|---------|---------------|------|
| Complete the request | Request - HD Route/Complete Request | `F9A56996-0EA6-4029-95C5-06A67315EED9` |

---

## Configuration Values

### Hardcoded IDs

| Name | Value | Purpose |
|------|-------|---------|
| Case Note Type Code | `168790000` | Type code for HD case notes |
| HD LOB ID | `1bd4b15a-bfbb-e511-9414-0050568dc724` | Help Desk line of business |

---

## Case Note Name Building

The case note name is built by concatenating:

```
[LOB] / [Type] / [Area] / [SubArea]
```

Example: `"HD/General Inquiry/Benefits/SubArea Name"`

Only non-empty values are included, separated by `/`.

---

## Error Handling

- All async operations are wrapped in try/catch blocks
- Errors are logged to console and displayed as form notifications
- Button shows "Processing..." state and is disabled during execution
- On unexpected error, generic message is shown to user

---

## Form Fields Used

### Read from Form

| Field | Type | Purpose |
|-------|------|---------|
| `customerid` | Lookup | Veteran |
| `vhacrm_typeintersectionid` | Lookup | Request type |
| `vhacrm_areaintersectionid` | Lookup | Request area |
| `vhacrm_subareaintersectionid` | Lookup | Request sub-area |
| `vhacrm_lobid` | Lookup | Line of Business |
| `vhacrm_resolutionintersectionid` | Lookup | Resolution |
| `vhacrm_casenotes_memo` | Memo | Case note text |
| `vhacrm_casenotetemplateid` | Lookup | Case note template |
| `ownerid` | Lookup | Record owner |

---

## Related Entities

| Entity | Relationship | Purpose |
|--------|--------------|---------|
| `vhacrm_casenote` | Created / Queried | Case note creation and today check |


---

## HTML Web Resource

The button is rendered as an iframe-embedded HTML page with:
- Bootstrap 4 CSS for styling
- Bootstrap 4 spinner component for loading state
- No custom CSS (uses Bootstrap utility classes)

### Dependencies

| Resource | Purpose |
|----------|----------|
| `bootstrap.min.css` | Button and spinner styling |
| `ClientGlobalContext.js.aspx` | Dynamics CRM context |
| `vhacrm_HDCompleteRequest.js` | Button logic |

---

## Differences from Other LOBs

| Feature | HD | EED | IVD | NCCHV |
|---------|-----|-----|-----|-------|
| **Case Note Creation** | ✅ Yes | ✅ Yes | ❌ No | ✅ Yes |
| **Audit Record Update** | ❌ No | ❌ No | ✅ Yes | ✅ Yes |
| **Veteran Field** | `customerid` | `customerid` | `customerid` | `customerid` |
| **Placeholder Veteran Handling** | ❌ No | ✅ Yes | ❌ No | ❌ No |
| **HEC Alert Handling** | ❌ No | ✅ Yes | ✅ Yes | ✅ Yes |
| **Enrollment API Call** | ❌ No | ❌ No | ✅ Yes | ❌ No |
| **Record URL Update** | ❌ No | ✅ Yes | ✅ Yes | ❌ No |
| **Contact Method Validation** | ❌ No | ✅ Yes | ✅ Yes | ✅ Yes |
| **Case Note Type Code** | `168790000` | `168790000` | N/A | `168790000` |

---

## Key Differences Summary

1. **Simpler Validation**: HD only requires a case note - no veteran, verification method, or contact method validations
2. **No Audit Record Update**: Unlike IVD and NCCHV, HD does not update audit records
3. **No HEC Alert**: Does not handle HEC Alert records
4. **LOB-Specific Workflow**: Only executes workflow if LOB matches HD GUID
