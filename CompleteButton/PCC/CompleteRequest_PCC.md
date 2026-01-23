# PCC Complete Request Button - Business Logic Documentation

*All code is based on the current North52 code in Production. North52 code that is commented out in the formula was left out of this javascript.*

## Overview

The PCC Complete Request button is an iframe-embedded button on the Request (Incident) form that validates and completes PCC (Patient Care Coordination) requests. It performs validation checks, creates case notes, triggers the completion workflow, and closes the form.

**Web Resource**: `CompleteRequest_PCC.html` / `CompleteRequest_PCC.js`

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
│     • Check closure reason count                                │
│     • Check closure reason type count                           │
│     • Check user team membership (Facility Pharmacy)            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. Run Validations                                             │
│     • Type required                                             │
│     • Area required                                             │
│     • Facility required                                         │
│     • Pharmacy required                                         │
│     • Veteran required                                          │
│     • Closure Reason (if user has Facility team)                │
│     • Case Note (if closure reason type requires it)            │
└─────────────────────────────────────────────────────────────────┘
                              │
            ┌─────────────────┴─────────────────┐
            │                                   │
            ▼                                   ▼
┌───────────────────────┐           ┌───────────────────────┐
│  Validation Failed    │           │  Validation Passed    │
│  Show error message   │           │                       │
│  Stop execution       │           │                       │
└───────────────────────┘           └───────────────────────┘
                                                │
                                                ▼
                              ┌─────────────────────────────────────────────────────────────────┐
                              │  4. Create Case Note (if memo populated)                        │
                              │     • Build name from LOB/Type/Area/SubArea                     │
                              │     • Link to Request, Veteran, Template                        │
                              └─────────────────────────────────────────────────────────────────┘
                                                │
                                                ▼
                              ┌─────────────────────────────────────────────────────────────────┐
                              │  5. Trigger Complete Workflow                                   │
                              │     • Set vhacrm_onpccnextactionbutton = true                   │
                              │     • This triggers a workflow that resolves the request        │
                              └─────────────────────────────────────────────────────────────────┘
                                                │
                                                ▼
                              ┌─────────────────────────────────────────────────────────────────┐
                              │  6. Save & Close Form                                           │
                              └─────────────────────────────────────────────────────────────────┘
```

---

## Validation Rules

### Pre-Validations (Blocking)

| Check | Field | Error Message |
|-------|-------|---------------|
| Resolution required | `vhacrm_resolutionintersectionid` | "A Resolution must be provided before completing the request." |
| Owner check | `ownerid` vs current user | "You must pick the request from the queue before completing the request." |

### Main Validations

| Field | Attribute | Required | Error Message |
|-------|-----------|----------|---------------|
| Type | `vhacrm_typeintersectionid` | Yes | "Type is required to resolve a Request." |
| Area | `vhacrm_areaintersectionid` | Yes | "Area is required to resolve a Request." |
| Facility | `vhacrm_facilityid` | Yes | "Facility is required to resolve a Request." |
| Pharmacy | `vhacrm_facilitypharmacyid` | Yes | "Pharmacy is required to resolve a Request." |
| Veteran | `customerid` | Yes | "Veteran is required to resolve a Request." |
| Closure Reason | (related records) | Conditional* | "Closure Reason is required to resolve a Request." |
| Case Note | `vhacrm_casenotes_memo` OR existing | Conditional** | "Case Note is required to resolve a Request." |

*Closure Reason required if user is a member of "PCC Facility Pharmacy" or "PCC Facility Pharmacy Tech" teams AND no closure reasons exist for the request.

**Case Note required if closure reason is one of the specific types that require it (matched by GUID) AND no case note exists today AND memo field is empty.

---

## Closure Reasons Requiring Case Note

The following closure reason GUIDs require a case note to be present:

| GUID | Description |
|------|-------------|
| `75c52ebd-d102-e811-9487-0050568dd32b` | (Specific closure reason 1) |
| `4094d1d3-d102-e811-9487-0050568dd32b` | (Specific closure reason 2) |

---

## Team Membership Check

The button checks if the current user belongs to specific teams:

| Team Name |
|-----------|
| PCC Facility Pharmacy |
| PCC Facility Pharmacy Tech |

If the user is a member of either team, the Closure Reason validation is enforced.

---

## Case Note Creation

**Condition**: `vhacrm_casenotes_memo` field has content

**Entity Created**: `vhacrm_casenote`

| Field | Attribute | Value |
|-------|-----------|-------|
| Name | `vhacrm_name` | `{LOB}/{Type}/{Area}/{SubArea}` |
| Memo | `vhacrm_casenotes_memo` | From form field |
| Type Code | `vhacrm_casenotetype_code` | `168790000` |
| Request | `vhacrm_requestid` | Current incident ID |
| Veteran | `vhacrm_veteranid` | From `customerid` lookup |
| Template | `vhacrm_casenotetemplateid` | From form (optional) |

---

## Configuration

```javascript
CompleteRequest_PCC.config = {
    // Case note type code
    caseNoteTypeCode: 168790000,
    
    // Team names for facility pharmacy check
    facilityPharmacyTeams: [
        "PCC Facility Pharmacy",
        "PCC Facility Pharmacy Tech"
    ],
    
    // Closure reason IDs that require a case note
    closureReasonsRequiringCaseNote: [
        "75c52ebd-d102-e811-9487-0050568dd32b",
        "4094d1d3-d102-e811-9487-0050568dd32b"
    ]
};
```

---

## Form Fields Used

### Read Fields

| Field | Attribute | Type |
|-------|-----------|------|
| Veteran | `customerid` | Lookup |
| Type | `vhacrm_typeintersectionid` | Lookup |
| Area | `vhacrm_areaintersectionid` | Lookup |
| Sub Area | `vhacrm_subareaintersectionid` | Lookup |
| Facility | `vhacrm_facilityid` | Lookup |
| Pharmacy | `vhacrm_facilitypharmacyid` | Lookup |
| Resolution | `vhacrm_resolutionintersectionid` | Lookup |
| LOB | `vhacrm_lobid` | Lookup |
| Case Note Memo | `vhacrm_casenotes_memo` | Text |
| Case Note Template | `vhacrm_casenotetemplateid` | Lookup |
| Owner | `ownerid` | Lookup |

---

## API Queries

### Case Note Existence Check

```
GET vhacrm_casenote?$select=vhacrm_casenoteid&$top=1
    &$filter=_vhacrm_requestid_value eq '{requestId}' 
    and _createdby_value eq '{userId}' 
    and createdon ge {startOfDay} 
    and createdon le {endOfDay}
    and vhacrm_interactionid eq null
```

### Closure Reason Count (via M:N Relationship)

```
GET incident({requestId})?$expand=vhacrm_vhacrm_facilityresponse_incident($select=vhacrm_facilityresponseid)
```

Returns the related facility responses (closure reasons) via the Many-to-Many relationship `vhacrm_vhacrm_facilityresponse_incident`.

### Closure Reason Type Count (Requires Case Note)

Uses the same query as Closure Reason Count, then filters client-side to only those matching the configured GUIDs in `closureReasonsRequiringCaseNote`.

```javascript
// Client-side filtering
const requiresCaseNote = closureReasons.filter(cr => 
    config.closureReasonsRequiringCaseNote.includes(cr.vhacrm_facilityresponseid.toLowerCase())
);
```

### User Team Membership

```
GET teammembership?$select=teamid
    &$filter=systemuserid eq '{userId}'

GET team?$select=teamid,name
    &$filter=(teamid eq '...' or ...) 
    and (name eq 'PCC Facility Pharmacy' or name eq 'PCC Facility Pharmacy Tech')
```

---

## HTML Structure

The button is rendered as an iframe-embedded HTML page with:
- Bootstrap 4 CSS for styling
- Bootstrap 4 spinner component for loading state
- No custom CSS (uses Bootstrap utility classes)

### Dependencies

| Resource | Purpose |
|----------|----------|
| `bootstrap.min.css` | Button and spinner styling |
| `ClientGlobalContext.js.aspx` | Dynamics CRM context |
| `vhacrm_CompleteRequest_PCC.js` | Button logic |

---

## Workflow Trigger

PCC triggers a workflow by setting a flag field on form save:

| Field | Value | Purpose |
|-------|-------|---------|
| `vhacrm_onpccnextactionbutton` | `true` | Triggers a workflow that resolves/completes the request |

When the form is saved with this field set to `true`, a workflow fires that handles the actual status change to resolve the request.

---

## PCC-Specific Features

1. **Team-Based Validation**: Checks if the user belongs to "PCC Facility Pharmacy" or "PCC Facility Pharmacy Tech" teams to determine if Closure Reason is required
2. **Pharmacy Field**: Requires the `vhacrm_facilitypharmacyid` field
3. **Closure Reason Logic**: Complex conditional validation based on team membership and closure reason counts
4. **Workflow via Flag**: Triggers workflow by setting `vhacrm_onpccnextactionbutton = true` rather than direct execution
