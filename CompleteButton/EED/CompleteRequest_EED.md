# EED Complete Request Button - Business Logic Documentation

*All code is based on the current North52 code in Production. North52 code that is commented out in the formula was left out of this javascript.*

## Overview

The EED Complete Request button is an iframe-embedded button on the Request (Incident) form that validates and completes EED (Enrollment Eligibility Division) requests. It performs validation checks, creates case notes, updates related records, triggers workflows, and closes the form.

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
│  2. Load Form Data & Resolution Name                            │
│     • Read all form fields into state                           │
│     • Fetch resolution name from lookup                         │
│     • Set resolution flags (Created in Error, Pending RAD)      │
│     • Set placeholder veteran flag                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────┴───────────────┐
              │   Is "Created in Error"?      │
              └───────────────┬───────────────┘
                     YES      │      NO
                      │       │       │
                      ▼       │       ▼
┌─────────────────────────┐   │   ┌─────────────────────────────────┐
│  Handle Created in Error│   │   │  3. Load Additional Data        │
│  • Run Deactivate WF    │   │   │     • Activity counts           │
│  • Save & Close         │   │   │       (correspondence, calls)   │
└─────────────────────────┘   │   │     • Case note exists today    │
                              │   └─────────────────────────────────┘
                              │                   │
                              │                   ▼
                              │   ┌─────────────────────────────────┐
                              │   │  4. Run Validations             │
                              │   │     (see Validation Rules)      │
                              │   └─────────────────────────────────┘
                              │                   │
                              │                   ▼
                              │   ┌─────────────────────────────────┐
                              │   │  5. Complete Request            │
                              │   │     • Create Case Note          │
                              │   │     • Update Incident fields    │
                              │   │     • Update Record URL         │
                              │   │     • Update HEC Alert          │
                              │   │     • Run Complete Workflow     │
                              │   │     • Save & Close              │
                              │   └─────────────────────────────────┘
```

---

## Resolution Types & Special Handling

| Resolution | Flag | Special Behavior |
|------------|------|------------------|
| **Created in Error** | `isCreatedInError` | Runs Deactivate workflow only, skips all other processing and validation |
| **Pending Future RAD** | `isPendingFutureRAD` | Requires RAD Date and Reevaluate Date |

---

## Placeholder Veteran Handling

EED has special handling for the **placeholder veteran** (`1b8680e1-8d87-e611-9422-0050568dade6` - "No Veteran, No Veteran").

When the customer is the placeholder veteran:
- Veteran validation is skipped
- Verification Method validation is skipped  
- Contact Method validation is skipped

---

## Validation Rules

Validations are **skipped entirely** for:
- Created in Error

### Standard Validations

| Rule | Condition | Error Message |
|------|-----------|---------------|
| **Veteran Required** | Veteran lookup is empty AND customer is NOT placeholder veteran | "Veteran is required to complete the request." |
| **Verification Method Required** | Verification method lookup is empty AND customer is NOT placeholder veteran | "Verification Method is required to complete the request." |
| **Contact Method Required** | No correspondence AND no phone calls AND "No Contact Required" is NOT checked AND customer is NOT placeholder veteran | "Veteran Contact Method is Required" |
| **RAD Date Required** | Resolution is "Pending Future RAD" AND RAD Date is empty | "RAD Date is required to complete the request." |
| **Reevaluate Date Required** | Resolution is "Pending Future RAD" AND Reevaluate Date is empty | "Reevaluate Date is required to complete the request." |
| **Case Note Required** | Case Note Memo is empty AND no case note exists today by current user | "A completed Case Note is required to complete the request." |

---

## Processing Steps (Standard Completion)

### 1. Create Case Note
**Condition**: Case Note Memo is populated AND Resolution is set

Creates a `vhacrm_casenote` record with:

| Field | Value |
|-------|-------|
| `vhacrm_name` | Built from LOB/Type/Area/SubArea (e.g., "EED/Type/Area/SubArea") |
| `vhacrm_casenotes_memo` | From form case note memo field |
| `vhacrm_requestid` | Link to current request |
| `vhacrm_casenotetype_code` | `168790000` |
| `vhacrm_veteranid` | Link to veteran (if present) |
| `vhacrm_hecalertid` | Link to HEC Alert (if present) |
| `vhacrm_casenotetemplateid` | Link to template (if present) |

### 2. Update Incident Case Note Fields
Updates the current incident with:

| Field | Value |
|-------|-------|
| `vhacrm_casenotehidden` | Copy of case note memo |
| `vhacrm_casenotetemplateid` | Set to null (clear template) |

### 3. Update Record URL
- Retrieves base URL from `bah_keyvaluepair` where `bah_name_text = 'base_url'`
- Updates `vhacrm_recordurl_memo` with full URL to the record

### 4. Update HEC Alert
**Condition**: HEC Alert lookup is populated

- Updates `vhacrm_hecalert` to inactive (`statecode: 1`, `statuscode: 713770006`)

### 5. Save Form
- Saves the form so workflow can read latest values

### 6. Execute Workflow
- **EED-Request Complete Request** (`68E7DAE8-93A7-4F73-AFB4-77C565E211CE`)

### 7. Close Form
- Navigates back or closes the form

---

## Workflows Used

| Purpose | Workflow Name | GUID |
|---------|---------------|------|
| Deactivate (Created in Error) | Request - Deactivate | `579F4A5D-E67E-404E-AA3A-896C3D5392FC` |
| Complete the request | EED-Request Complete Request | `68E7DAE8-93A7-4F73-AFB4-77C565E211CE` |

---

## Configuration Values

### Hardcoded IDs

| Name | Value | Purpose |
|------|-------|---------|
| Case Note Type Code | `168790000` | Type code for EED case notes |
| HEC Alert Completed Status | `713770006` | Status code for completed HEC alerts |
| Placeholder Veteran ID | `1b8680e1-8d87-e611-9422-0050568dade6` | "No Veteran, No Veteran" placeholder |

### Key Value Pairs (from `bah_keyvaluepair` entity)

| Key | Purpose |
|-----|---------|
| `base_url` | CRM base URL for building record links |

---

## Case Note Name Building

The case note name is built by concatenating:

```
[LOB] / [Type] / [Area] / [SubArea]
```

Example: `"EED/Income Verification/General Inquiry/SubArea Name"`

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
| `vhacrm_facilityid` | Lookup | Facility |
| `vhacrm_resolutionintersectionid` | Lookup | Resolution |
| `vhacrm_verificationmethodid` | Lookup | Verification method |
| `vhacrm_casenotes_memo` | Memo | Case note text |
| `vhacrm_casenotetemplateid` | Lookup | Case note template |
| `vhacrm_raddate_date` | Date | RAD date |
| `vhacrm_reevaluatedate_date` | Date | Reevaluate date |
| `vhacrm_nocontactrequired_bool` | Boolean | No contact required flag |
| `vhacrm_hecalertid` | Lookup | Associated HEC Alert |
| `ownerid` | Lookup | Record owner |

### Written to Form/Record

| Field | When |
|-------|------|
| `vhacrm_casenotehidden` | During completion (copy of case note memo) |
| `vhacrm_casenotetemplateid` | During completion (cleared) |
| `vhacrm_recordurl_memo` | During completion |

---

## Related Entities

| Entity | Relationship | Purpose |
|--------|--------------|---------|
| `vhacrm_correspondence` | Queried (count) | Contact method validation |
| `phonecall` | Queried (count) | Contact method validation |
| `vhacrm_casenote` | Created / Queried | Case note creation and today check |
| `vhacrm_hecalert` | Updated | HEC Alert resolution |
| `vhacrm_resolutionintersection` | Queried | Resolution name lookup |
| `bah_keyvaluepair` | Queried | Configuration values |

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
| `vhacrm_CompleteRequest_EED.js` | Button logic |

