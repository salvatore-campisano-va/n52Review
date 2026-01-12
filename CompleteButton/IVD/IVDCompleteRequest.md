# IVD Complete Request Button - Business Logic Documentation

*All code is based on the current North52 code in Production. North52 code that is commented out in the formula was left out of this javascript.*

## Overview

The IVD Complete Request button is an iframe-embedded button on the Request (Incident) form that validates and completes IVD (Income Verification Division) requests. It performs validation checks, updates related records, triggers workflows, and closes the form.

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
│  • Run Deactivate WF    │   │   │     • Verification Method       │
│  • Update record        │   │   │     • Correspondence count      │
│  • Save & Close         │   │   │     • Phone call count          │
└─────────────────────────┘   │   └─────────────────────────────────┘
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
                              │   │     • Update Audit Record       │
                              │   │     • Call Enrollment API       │
                              │   │     • Update Request Record     │
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
| **Pending Future RAD** | `isPendingRad` | Requires RAD Date and Reevaluate Date |

---

## Validation Rules

Validations are **skipped entirely** for:
- Created in Error

### Standard Validations

| Rule | Condition | Error Message |
|------|-----------|---------------|
| **Veteran Required** | Veteran lookup is empty | "A Veteran is required to complete the request." |
| **Verification Method Required** | Verification method lookup is empty | "Verification Method is required to complete the request." |
| **Contact Method Required** | No correspondence AND no phone calls AND "No Contact Required" is NOT checked | "Veteran Contact Method is required." |
| **RAD Date Required** | Resolution is "Pending Future RAD" AND RAD Date is empty | "RAD Date is required to complete the request." |
| **Reevaluate Date Required** | Resolution is "Pending Future RAD" AND Reevaluate Date is empty | "Reevaluate Date is required to complete the request." |

---

## Processing Steps (Standard Completion)

### 1. Update Audit Record
Finds the most recent `vhacrm_requestroutingaudit` record for this request and updates:

| Field | Value |
|-------|-------|
| `vhacrm_completedon_date` | Current timestamp |
| `vhacrm_daysassigned_number` | Days at assignment from form |
| `statecode` | `1` (Inactive) |
| `statuscode` | `2` |

### 2. Call Enrollment Status API
**Condition**: ICN is populated

- Retrieves endpoint URL from `bah_keyvaluepair` where `bah_name_text = 'esr_endpoint'`
- Calls API with veteran's ICN
- Stores enrollment status in state for later use

### 3. Update Request Record
Updates the current incident with:

| Field | Value |
|-------|-------|
| `vhacrm_recordurl_memo` | Full URL to the record |
| `vhacrm_enrollmentstatus_text` | From enrollment API response |

### 4. Update HEC Alert
**Condition**: HEC Alert lookup is populated

- Updates `vhacrm_hecalert` to inactive (`statecode: 1`, `statuscode: 713770006`)

### 5. Execute Workflow
- **Complete Request** (`68E7DAE8-93A7-4F73-AFB4-77C565E211CE`)

### 6. Save & Close
- Saves the form
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
| HEC Alert Inactive Status | `713770006` | Status code for completed HEC alerts |

### Key Value Pairs (from `bah_keyvaluepair` entity)

| Key | Purpose |
|-----|---------|
| `esr_endpoint` | Enrollment status API URL (with `{0}` placeholder for ICN) |
| `base_url` | CRM base URL for building record links |

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
| `vhacrm_resolutionintersectionid` | Lookup | Resolution |
| `vhacrm_verificationmethodid` | Lookup | Verification method |
| `vhacrm_raddate_date` | Date | RAD date |
| `vhacrm_reevaluatedate_date` | Date | Reevaluate date |
| `vhacrm_nocontactrequired_bool` | Boolean | No contact required flag |
| `vhacrm_icn_text` | Text | Integration Control Number |
| `vhacrm_hecalertid` | Lookup | Associated HEC Alert |
| `vhacrm_daysatassignment_number` | Number | Days at current assignment |
| `ownerid` | Lookup | Record owner |

### Written to Form/Record
| Field | When |
|-------|------|
| `vhacrm_recordurl_memo` | During completion |
| `vhacrm_enrollmentstatus_text` | During completion |
| `vhacrm_returnemailnotes` | Created in Error handling |

---

## Related Entities

| Entity | Relationship | Purpose |
|--------|--------------|---------|
| `vhacrm_correspondence` | Queried (count) | Contact method validation |
| `activitypointer` (phonecall) | Queried (count) | Contact method validation |
| `vhacrm_requestroutingaudit` | Updated | Audit trail |
| `vhacrm_hecalert` | Updated | HEC Alert resolution |
| `vhacrm_resolutionintersection` | Queried | Resolution name lookup |
| `bah_keyvaluepair` | Queried | Configuration values |
