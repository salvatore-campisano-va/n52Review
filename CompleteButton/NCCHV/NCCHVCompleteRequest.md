# NCCHV Complete Request Button - Business Logic Documentation

*All code is based on the current North52 code in Production. North52 code that is commented out in the formula was left out of this javascript.*

## Overview

The NCCHV Complete Request button is an iframe-embedded button on the Request (Incident) form that validates required fields, creates case notes, updates audit records, executes a completion workflow, and closes NCCHV (National Call Center for Homeless Veterans) requests.
 
**Web Resource**: `NCCHVCompleteRequest.html` / `NCCHVCompleteRequest.js`

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
│     • Resolution must be selected                               │
│     • Current user must be the record owner                     │
│     (Errors shown immediately if failed)                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. Load Form Data                                              │
│     • Read all required fields from form into state object      │
│     • Query vhacrm_casenote entity to check if case note        │
│       exists for this request, created by current user, TODAY   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. Run Field Validations                                       │
│     • Type is required                                          │
│     • Area is required                                          │
│     • Facility is required                                      │
│     • Veteran is required                                       │
│     • Veteran Outcome is required                               │
│     • Case Note required (memo populated OR note exists today)  │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │ Validation Errors? │
                    └─────────┬─────────┘
               NO             │            YES
                │             │              │
                ▼             │              ▼
┌───────────────────────────────────┐   ┌─────────────────────────────┐
│  4. Complete Request Processing   │   │  Show Error Messages        │
│  4a. Create Case Note (if memo)   │   │  (pipe-delimited list)      │
│  4b. Update Audit Record          │   │  (Stop processing)          │
│  4c. Save Form                    │   └─────────────────────────────┘
│  4d. Execute Workflow             │
│  4e. Close Form                   │
└───────────────────────────────────┘
```

---

## Validation Rules

### Pre-Validations (Block Immediately)

These checks happen before any data is loaded. If they fail, an error is shown and processing stops immediately.

| Rule | Field Checked | Error Message |
|------|---------------|---------------|
| Resolution required | `vhacrm_resolutionintersectionid` | "A Resolution must be provided before completing the request." |
| Owner check | `ownerid` vs current user | "You must pick the request from the queue before completing the request." |

**Owner Check Logic**: Compares the `ownerid` lookup value on the form to the current user's system user ID. Both GUIDs are cleaned (braces removed, lowercase) before comparison.

### Field Validations

All validation errors are collected and displayed together, separated by ` | `.

| Field | Schema Name | Required | Error Message |
|-------|-------------|----------|---------------|
| Type | `vhacrm_typeintersectionid` | Yes | "Type is required to resolve a Request." |
| Area | `vhacrm_areaintersectionid` | Yes | "Area is required to resolve a Request." |
| Facility | `vhacrm_facilityid` | Yes | "Facility is required to resolve a Request." |
| Veteran | `customerid` | Yes | "Veteran is required to resolve a Request." |
| Veteran Outcome | `vhacrm_veteranoutcomeid` | Yes | "Veteran Outcome is required to resolve a Request." |
| Case Note | `vhacrm_casenotes_memo` OR existing | Yes* | "Case Note is required to resolve a Request." |

### Case Note Validation (Special Logic)

The case note requirement is satisfied if **EITHER** condition is true:
1. The `vhacrm_casenotes_memo` field has content (will create a new case note), **OR**
2. A `vhacrm_casenote` record already exists that meets ALL of these criteria:
   - Linked to the current request (`_vhacrm_requestid_value`)
   - Created by the current user (`_createdby_value`)
   - Created **today** (between 00:00:00 and 23:59:59 UTC)

**Case Note Query**: Queries the `vhacrm_casenote` entity filtering by request ID, created by (current user), and createdon date range (start of today to end of today in UTC). Returns top 1 record to check existence.

---

## Processing Steps (After Validation Passes)

### Step 1: Create Case Note

**Conditions**: 
- `vhacrm_casenotes_memo` field has content
- `customerid` (Veteran) lookup is populated

**Entity Created**: `vhacrm_casenote`

| Field | Schema Name | Value | Notes |
|-------|-------------|-------|-------|
| Name | `vhacrm_name` | `{LOB}/{Type}/{Area}/{SubArea}` | Concatenated from lookup names |
| Memo | `vhacrm_casenotes_memo` | From form field | The case note content |
| Type Code | `vhacrm_casenotetype_code` | `168790000` | Option set value |
| Request | `vhacrm_requestid` | Current incident ID | OData bind to `/incidents({id})` |
| Veteran | `vhacrm_veteranid` | From `customerid` lookup | OData bind to `/contacts({id})` |
| Template | `vhacrm_casenotetemplateid` | From form (optional) | Only set if template selected |

**Case Note Name Format**: `{LOB Name}/{Type Name}/{Area Name}/{SubArea Name}`  
Example: `NCCHV/Housing/Emergency Shelter/Referral`

### Step 2: Update Audit Record

**Query**: Finds the most recent `vhacrm_requestroutingaudit` record for this request by filtering on `_vhacrm_requestid_value`, ordering by `createdon` descending, and taking the top 1 result.

**Update Payload**:

| Field | Schema Name | Value | Notes |
|-------|-------------|-------|-------|
| Completed On | `vhacrm_completedon_date` | `new Date().toISOString()` | Current timestamp |
| Days Assigned | `vhacrm_daysassigned_number` | From `vhacrm_daysatassignment_number` | Copied from request |
| State | `statecode` | `1` | Inactive |
| Status | `statuscode` | `2` | Inactive status reason |

### Step 3: Save Form

Saves all pending changes on the form so the workflow can read the latest field values.

**Why save before workflow?** The workflow runs server-side and queries the database. Any unsaved changes on the form would not be visible to the workflow.

### Step 4: Execute Workflow

**Workflow**: Request - NCCHV Route/Complete Request  
**GUID**: `381d264d-ac3d-43b0-ba95-2ba2cb2a5506`  
**Type**: Classic Workflow (on-demand)

**Execution Method**: Uses `Xrm.WebApi.online.execute` with the `ExecuteWorkflow` action, passing the workflow GUID and the target incident ID.

**Workflow Responsibilities**:
- Validates field values on the request (server-side)
- Resolves/closes the Incident record (sets `statecode` and `statuscode`)
- May perform additional routing or notification logic

### Step 5: Close Form

Closes the form after the workflow completes. Uses modern UCI navigation (`Xrm.Navigation.navigateBack`) if available, otherwise falls back to legacy `formContext.ui.close()`.

---

## Form Fields Used

### Fields Read from Form

| Display Name | Schema Name | Type | Purpose |
|--------------|-------------|------|---------|
| Resolution | `vhacrm_resolutionintersectionid` | Lookup | Pre-validation check |
| Owner | `ownerid` | Lookup | Pre-validation - must match current user |
| Veteran | `customerid` | Lookup | Required validation + case note creation |
| Type | `vhacrm_typeintersectionid` | Lookup | Required validation + case note name |
| Area | `vhacrm_areaintersectionid` | Lookup | Required validation + case note name |
| Facility | `vhacrm_facilityid` | Lookup | Required validation |
| Veteran Outcome | `vhacrm_veteranoutcomeid` | Lookup | Required validation |
| Case Note Memo | `vhacrm_casenotes_memo` | Multiline Text | Case note content |
| Case Note Template | `vhacrm_casenotetemplateid` | Lookup | Optional - for case note |
| LOB | `vhacrm_lobid` | Lookup | Case note name prefix |
| Sub-Area | `vhacrm_subareaintersectionid` | Lookup | Case note name suffix |
| Days at Assignment | `vhacrm_daysatassignment_number` | Whole Number | Copied to audit record |

### Fields NOT Modified Directly

The button does **not** directly modify any fields on the Incident record. The workflow handles status changes.

---

## Related Entities

| Entity | Logical Name | Operation | Purpose |
|--------|--------------|-----------|---------|
| Case Note | `vhacrm_casenote` | Query + Create | Check for existing today's notes; create new note |
| Request Routing Audit | `vhacrm_requestroutingaudit` | Query + Update | Update completion timestamp and deactivate |
| Workflow | `workflow` | Execute | Trigger the completion workflow |

---

## Error Handling

### User-Facing Errors
- Displayed as form notifications using `formContext.ui.setFormNotification()`
- Notification ID: `NCCHV_ERROR`
- Cleared at the start of each button click

### Error Display Format
- Multiple validation errors are joined with ` | ` separator
- Example: `"Type is required to resolve a Request. | Area is required to resolve a Request."`

### Loading State
- Button text changes to "Processing..." during execution
- Button is disabled (via CSS class `btn-loading`) to prevent double-clicks
- Button is re-enabled in `finally` block even if errors occur

### Console Logging
- All operations log success/failure to browser console
- Useful for debugging in development

### Unexpected Errors
- Caught by top-level try/catch in `execute()`
- Shows alert dialog: "An unexpected error occurred. Please try again."

---

## Configuration Values

| Name | Value | Purpose |
|------|-------|---------|
| Case Note Type Code | `168790000` | Option set value for `vhacrm_casenotetype_code` |
| Complete Workflow ID | `381d264d-ac3d-43b0-ba95-2ba2cb2a5506` | GUID for "Request - NCCHV Route/Complete Request" workflow |
| Error Notification ID | `NCCHV_ERROR` | Unique ID for form notifications |
| Button Element ID | `CompleteRequest` | HTML element ID in the iframe |

---

## Technical Notes

### Iframe Context
The button runs inside an iframe embedded on the form. To access the parent form, it uses `parent.Xrm` for the Xrm namespace, `parent.Xrm.Page` for legacy form context, or `parent.formContext` for modern form context if passed.

### GUID Handling
All GUIDs are cleaned before use by removing curly braces and converting to lowercase.  
Example: `{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}` → `a1b2c3d4-e5f6-7890-abcd-ef1234567890`

### Date Handling for Case Note Query
The "today" check uses UTC dates to match Dataverse storage. Calculates the start of day (00:00:00 UTC) and end of day (23:59:59 UTC) for the current date.

### Async/Await Pattern
All WebApi calls use async/await with try/catch blocks for error handling. Errors are logged to console and re-thrown with user-friendly messages.
