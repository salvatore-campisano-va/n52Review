# PCC Next Step Button - Business Logic Documentation

## Overview

The PCC Next Step button is an iframe-embedded button on the Request (Incident) form that validates required fields, creates case notes, and advances PCC (Patient Care Coordination) requests to their next action step.

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
│     • Action must be selected                                   │
│     • Current user must be the record owner                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. Load Form Data                                              │
│     • Read all required fields into state                       │
│     • Check if case note already exists for this user           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. Run Validations                                             │
│     • Type required                                             │
│     • Area required                                             │
│     • Facility required                                         │
│     • Facility Pharmacy required                                │
│     • Veteran required                                          │
│     • Case Note required (memo OR existing note)                │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │ Validation Errors? │
                    └─────────┬─────────┘
               NO             │            YES
                │             │              │
                ▼             │              ▼
┌───────────────────────┐     │   ┌─────────────────────────────┐
│  4. Process Request   │     │   │  Show Error Messages        │
│  • Create Case Note   │     │   │  (Stop processing)          │
│  • Trigger Workflow   │     │   └─────────────────────────────┘
│  • Save & Close       │     │
└───────────────────────┘     │
```

---

## Validation Rules

### Pre-Validations (Block Immediately)

| Rule | Error Message |
|------|---------------|
| Action not selected | "Please select an Action before continuing." |
| User is not the owner | "You must pick the request from the queue before proceeding." |

### Field Validations

| Field | Required | Error Message |
|-------|----------|---------------|
| Type | Yes | "Type is required to process next step." |
| Area | Yes | "Area is required to process next step." |
| Facility | Yes | "Facility is required to process next step." |
| Facility Pharmacy | Yes | "Facility Pharmacy is required to process next step." |
| Veteran | Yes | "Veteran is required to process next step." |
| Case Note | Yes* | "Please enter a Case Note before proceeding with action." |

*Case Note is satisfied if EITHER:
- The Case Note Memo field has content, OR
- A case note record already exists for this request created by the current user

---

## Processing Steps

### 1. Create Case Note
**Condition**: Case Note Memo field has content AND Veteran is set

| Field | Value |
|-------|-------|
| `vhacrm_name` | `{LOB}/{Type}/{Area}/{SubArea}` |
| `vhacrm_casenotes_memo` | From Case Note Memo field |
| `vhacrm_casenotetype_code` | `168790000` |
| `vhacrm_requestid` | Current request |
| `vhacrm_veteranid` | Veteran from request |
| `vhacrm_casenotetemplateid` | Template if selected |

### 2. Trigger Next Action Workflow
Sets the `vhacrm_onpccnextactionbutton` field to `true`, which triggers the "PCC - Initiate Next Action" workflow on save.

### 3. Save & Close
- Saves the form
- Navigates back or closes the form

---

## Form Fields Used

### Read from Form

| Field | Type | Purpose |
|-------|------|---------|
| `vhacrm_actionintersectionid` | Lookup | Action selection (pre-validation) |
| `ownerid` | Lookup | Record owner (pre-validation) |
| `customerid` | Lookup | Veteran |
| `vhacrm_typeintersectionid` | Lookup | Request Type |
| `vhacrm_areaintersectionid` | Lookup | Area |
| `vhacrm_facilityid` | Lookup | Facility |
| `vhacrm_facilitypharmacyid` | Lookup | Facility Pharmacy |
| `vhacrm_casenotes_memo` | Memo | Case Note content |
| `vhacrm_casenotetemplateid` | Lookup | Case Note template |
| `vhacrm_lobid` | Lookup | Line of Business (for case note name) |
| `vhacrm_subareaintersectionid` | Lookup | Sub-Area (for case note name) |

### Written to Form

| Field | When |
|-------|------|
| `vhacrm_onpccnextactionbutton` | Set to `true` to trigger workflow |

---

## Related Entities

| Entity | Relationship | Purpose |
|--------|--------------|---------|
| `vhacrm_casenote` | Created/Queried | Case notes for the request |

---

## Workflow Triggered

| Trigger Field | Workflow |
|---------------|----------|
| `vhacrm_onpccnextactionbutton = true` | PCC - Initiate Next Action |

---

## Error Handling

- All async operations are wrapped in try/catch blocks
- Errors are logged to console and displayed as alert dialogs
- Button shows "Processing..." state and is disabled during execution
- On unexpected error, generic message is shown to user

---

## Configuration Values

| Name | Value | Purpose |
|------|-------|---------|
| Case Note Type Code | `168790000` | Option set value for case note type |
