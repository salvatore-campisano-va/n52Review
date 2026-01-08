'use-strict';

var IVDCompleteRequest = IVDCompleteRequest || {};

IVDCompleteRequest = {
    Xrm: parent.Xrm,
    USERID: parent.Xrm.Page.context.getUserId().replace("{", "").replace("}", "").toLowerCase(),

    REQUEST: {
        ID: null,
        Vet: null,
        Type: null,
        Resolution: null,
        VerificationMethod: null,
        RADDate: null,
        ReevaluateDate: null,
        NoContactRequired: null,
        CaseNote: null,
        CaseNoteTemplate: null,
        ICN: null,
        HECAlert: null
    },

    VARS: {
        ResolutionName: '',
        enteredinerror: 'no',
        pendingrad: 'no',
        undeterminedveteran: 'no',
        createdinerror: 'no',
        correspondenceCount: 0,
        phonecallCount: 0,
        es: '',
        OldAuditRecordId: null
    },

    init: function () {
        document.getElementById("CompleteRequest").addEventListener("click", IVDCompleteRequest.Start);
    },

    Start: function () {
        IVDCompleteRequest.EnableDisableButton("disable");

        IVDCompleteRequest.REQUEST.Resolution = parent.Xrm.Page.getAttribute("vhacrm_resolutionintersectionid").getValue();

        if (!IVDCompleteRequest.REQUEST.Resolution) {
            IVDCompleteRequest.ShowError("A Resolution must be provided before completing the request.");
            return;
        }

        if (!IVDCompleteRequest.IsCurrentUserOwner()) {
            IVDCompleteRequest.ShowError("You must pick the request from the queue before completing the request.");
            return;
        }

        IVDCompleteRequest.LoadFormData();
        IVDCompleteRequest.GetResolutionName(function () {
            IVDCompleteRequest.SetResolutionFlags();
            IVDCompleteRequest.RunValidationsAndFinish();
        });
    },

    LoadFormData: function () {
        IVDCompleteRequest.REQUEST.ID = parent.Xrm.Page.data.entity.getId().replace(/[{}]/g, "");
        IVDCompleteRequest.REQUEST.Vet = parent.Xrm.Page.getAttribute("customerid").getValue();
        IVDCompleteRequest.REQUEST.Type = parent.Xrm.Page.getAttribute("vhacrm_typeintersectionid").getValue();
        IVDCompleteRequest.REQUEST.VerificationMethod = parent.Xrm.Page.getAttribute("vhacrm_verificationmethodid").getValue();
        IVDCompleteRequest.RADDate = parent.Xrm.Page.getAttribute("vhacrm_raddate_date").getValue();
        IVDCompleteRequest.REQUEST.ReevaluateDate = parent.Xrm.Page.getAttribute("vhacrm_reevaluatedate_date").getValue();
        IVDCompleteRequest.REQUEST.NoContactRequired = parent.Xrm.Page.getAttribute("vhacrm_nocontactrequired_bool").getValue();
        IVDCompleteRequest.REQUEST.CaseNote = parent.Xrm.Page.getAttribute("vhacrm_casenotes_memo").getValue();
        IVDCompleteRequest.REQUEST.CaseNoteTemplate = parent.Xrm.Page.getAttribute("vhacrm_casenotetemplateid").getValue();
        IVDCompleteRequest.REQUEST.ICN = parent.Xrm.Page.getAttribute("vhacrm_icn_text").getValue();
        IVDCompleteRequest.REQUEST.HECALert = parent.Xrm.Page.getAttribute("vhacrm_hecalertid").getValue();
    },

    IsCurrentUserOwner: function () {
        var owner = parent.Xrm.Page.getAttribute("ownerid").getValue();
        if (!owner) return false;
        var ownerId = owner[0].id.replace(/[{}]/g, "").toLowerCase();
        return ownerId === IVDCompleteRequest.USERID;
    },

    GetResolutionName: function (callback) {
        var resId = IVDCompleteRequest.REQUEST.Resolution[0].id.replace(/[{}]/g, "");
        var req = new XMLHttpRequest();
        req.open("GET", parent.Xrm.Page.context.getClientUrl() + "/api/data/v9.1/vhacrm_resolutionintersections(" + resId + ")?$select=vhacrm_name", false);
        req.setRequestHeader("OData-MaxVersion", "4.0");
        req.setRequestHeader("OData-Version", "4.0");
        req.setRequestHeader("Accept", "application/json");
        req.send();

        if (req.status === 200) {
            var result = JSON.parse(req.response);
            IVDCompleteRequest.VARS.ResolutionName = result.vhacrm_name || "";
        }
        callback();
    },

    SetResolutionFlags: function () {
        IVDCompleteRequest.VARS.enteredinerror       = (IVDCompleteRequest.VARS.ResolutionName === "Entered in Error") ? "yes" : "no";
        IVDCompleteRequest.VARS.createdinerror       = (IVDCompleteRequest.VARS.ResolutionName === "Created in Error") ? "yes" : "no";
        IVDCompleteRequest.VARS.pendingrad           = (IVDCompleteRequest.VARS.ResolutionName === "Pending Future RAD") ? "yes" : "no";
        IVDCompleteRequest.VARS.undeterminedveteran = (IVDCompleteRequest.VARS.ResolutionName === "No Action - Undetermined Veteran") ? "yes" : "no";
    },

    RunValidationsAndFinish: function () {
        // Created in Error → deactivate + close
        if (IVDCompleteRequest.VARS.createdinerror === "yes") {
            IVDCompleteRequest.ExecuteWorkflow("Request - Deactivate", IVDCompleteRequest.REQUEST.ID);
            IVDCompleteRequest.UpdateRecord("incident", IVDCompleteRequest.REQUEST.ID, { vhacrm_returnemailnotes: "saveandclose" });
            parent.Xrm.Page.data.save("saveandclose");
            return;
        }

        var errors = [];

        if (IVDCompleteRequest.VARS.enteredinerror === "no" && IVDCompleteRequest.VARS.createdinerror === "no") {
            var vetId = IVDCompleteRequest.REQUEST.Vet ? IVDCompleteRequest.REQUEST.Vet[0].id.replace(/[{}]/g, "").toUpperCase() : "";

            // Veteran required?
            if (vetId === "1B8680E1-8D87-E611-9422-0050568DADE6" && IVDCompleteRequest.VARS.undeterminedveteran === "no") {
                errors.push("Veteran is required to complete the request.");
            }

            // Verification Method required?
            if (!IVDCompleteRequest.REQUEST.VerificationMethod && IVDCompleteRequest.VARS.undeterminedveteran === "no" && vetId !== "1B8680E1-8D87-E611-9422-0050568DADE6") {
                errors.push("Verification Method is required to complete the request.");
            }

            // Contact method count
            IVDCompleteRequest.GetActivityCount("vhacrm_correspondence", function (c) { IVDCompleteRequest.VARS.correspondenceCount = c; });
            IVDCompleteRequest.GetActivityCount("phonecall", function (c) { IVDCompleteRequest.VARS.phonecallCount = c; });

            if (IVDCompleteRequest.VARS.undeterminedveteran === "no" &&
                IVDCompleteRequest.VARS.correspondenceCount === 0 &&
                IVDCompleteRequest.VARS.phonecallCount === 0 &&
                IVDCompleteRequest.REQUEST.NoContactRequired !== true &&
                vetId !== "1B8680E1-8D87-E611-9422-0050568DADE6") {
                errors.push("Veteran Contact Method is Required");
            }
        }

        // Pending Future RAD dates
        if (IVDCompleteRequest.VARS.pendingrad === "yes") {
            if (!IVDCompleteRequest.REQUEST.RADDate) errors.push("RAD Date is required to complete the request.");
            if (!IVDCompleteRequest.REQUEST.ReevaluateDate) errors.push("Reevaluate Date is required to complete the request.");
        }

        if (errors.length > 0) {
            IVDCompleteRequest.ShowError(errors.join(" | "));
            return;
        }

        // All validations passed → proceed to close
        IVDCompleteRequest.CreateCaseNoteIfNeeded();
        IVDCompleteRequest.UpdateAuditIfNeeded();
        IVDCompleteRequest.CallEnrollmentStatusAPI();
        IVDCompleteRequest.UpdateRequestAndRunWorkflows();
        parent.Xrm.Page.data.save("saveandclose");
    },

    CreateCaseNoteIfNeeded: function () {
        if (!IVDCompleteRequest.REQUEST.CaseNote) return;

        var name = "";
        var lob = parent.Xrm.Page.getAttribute("vhacrm_lobid").getValue();
        if (lob) name += lob[0].name + "/";
        if (IVDCompleteRequest.REQUEST.Type) name += IVDCompleteRequest.REQUEST.Type[0].name + "/";
        var area = parent.Xrm.Page.getAttribute("vhacrm_areaintersectionid").getValue();
        if (area) name += area[0].name + "/";
        var sub = parent.Xrm.Page.getAttribute("vhacrm_subareaintersectionid").getValue();
        if (sub) name += sub[0].name;

        var entity = {
            vhacrm_name: name,
            vhacrm_casenotes_memo: IVDCompleteRequest.REQUEST.CaseNote,
            vhacrm_casenotetype_code: 168790000,
            "vhacrm_requestid@odata.bind": "/incidents(" + IVDCompleteRequest.REQUEST.ID + ")",
            "vhacrm_veteranid@odata.bind": "/contacts(" + (IVDCompleteRequest.REQUEST.Vet ? IVDCompleteRequest.REQUEST.Vet[0].id.replace(/[{}]/g, "") : "") + ")"
        };

        if (IVDCompleteRequest.REQUEST.CaseNoteTemplate) {
            entity["vhacrm_casenotetemplateid@odata.bind"] = "/vhacrm_casenotetemplates(" + IVDCompleteRequest.REQUEST.CaseNoteTemplate[0].id.replace(/[{}]/g, "") + ")";
        }

        var req = new XMLHttpRequest();
        req.open("POST", parent.Xrm.Page.context.getClientUrl() + "/api/data/v9.1/vhacrm_casenotes", false);
        req.setRequestHeader("OData-MaxVersion", "4.0");
        req.setRequestHeader("OData-Version", "4.0");
        req.setRequestHeader("Content-Type", "application/json");
        req.send(JSON.stringify(entity));

        // Also store in hidden field and clear template
        IVDCompleteRequest.UpdateRecord("incident", IVDCompleteRequest.REQUEST.ID, {
            vhacrm_casenotehidden: IVDCompleteRequest.REQUEST.CaseNote,
            "vhacrm_casenotetemplateid@odata.bind": null
        });
    },

    UpdateAuditIfNeeded: function () {
        if (IVDCompleteRequest.VARS.enteredinerror === "yes") return;

        var req = new XMLHttpRequest();
        req.open("GET", parent.Xrm.Page.context.getClientUrl() +
            "/api/data/v9.1/vhacrm_requestroutingaudits?$select=vhacrm_requestroutingauditid&$filter=_vhacrm_requestid_value eq " + IVDCompleteRequest.REQUEST.ID +
            "&$orderby=createdon desc&$top=1", false);
        req.setRequestHeader("OData-MaxVersion", "4.0");
        req.setRequestHeader("OData-Version", "4.0");
        req.send();

        if (req.status === 200) {
            var result = JSON.parse(req.response);
            if (result.value && result.value.length > 0) {
                IVDCompleteRequest.VARS.OldAuditRecordId = result.value[0].vhacrm_requestroutingauditid;

                IVDCompleteRequest.UpdateRecord("vhacrm_requestroutingaudit", IVDCompleteRequest.VARS.OldAuditRecordId, {
                    vhacrm_completedon_date: new Date(),
                    vhacrm_daysassigned_number: parent.Xrm.Page.getAttribute("vhacrm_daysatassignment_number").getValue(),
                    statecode: 1,
                    statuscode: 2
                });
            }
        }
    },

    CallEnrollmentStatusAPI: function () {
        if (IVDCompleteRequest.VARS.enteredinerror === "yes" || !IVDCompleteRequest.REQUEST.ICN) return;

        var endpoint = IVDCompleteRequest.GetKeyValuePair("esr_endpoint");
        if (!endpoint) return;

        var url = endpoint.replace("{0}", IVDCompleteRequest.REQUEST.ICN);
        var vaGovPos = url.indexOf("va.gov");
        var base = url.substring(0, vaGovPos + 6);
        var resource = url.substring(vaGovPos + 6);

        var req = new XMLHttpRequest();
        req.open("GET", base + resource, false);
        req.send();

        if (req.status === 200) {
            var json = JSON.parse(req.responseText);
            IVDCompleteRequest.VARS.es = json.Data?.EnrollmentDeterminationInfo?.EnrollmentStatus || "";
        }
    },

    UpdateRequestAndRunWorkflows: function () {
        var baseUrl = IVDCompleteRequest.GetKeyValuePair("base_url");
        var recordUrl = baseUrl + "main.aspx?etn=incident&id=" + IVDCompleteRequest.REQUEST.ID + "&pagetype=entityrecord";

        IVDCompleteRequest.UpdateRecord("incident", IVDCompleteRequest.REQUEST.ID, {
            vhacrm_recordurl_memo: recordUrl,
            vhacrm_enrollmentstatus_text: IVDCompleteRequest.VARS.es
        });

        if (IVDCompleteRequest.REQUEST.HECALert) {
            var hecId = IVDCompleteRequest.REQUEST.HECALert[0].id.replace(/[{}]/g, "");
            IVDCompleteRequest.UpdateRecord("vhacrm_hecalert", hecId, { statecode: 1, statuscode: 713770006 });
            IVDCompleteRequest.ExecuteWorkflow("EED-Send HEC Alert Complete Notification", IVDCompleteRequest.REQUEST.ID);
        }

        IVDCompleteRequest.ExecuteWorkflow("Request - Send Request Complete Return Email", IVDCompleteRequest.REQUEST.ID);
        IVDCompleteRequest.ExecuteWorkflow("EED-Request Complete Request", IVDCompleteRequest.REQUEST.ID);
    },

    GetKeyValuePair: function (keyName) {
        var req = new XMLHttpRequest();
        req.open("GET", parent.Xrm.Page.context.getClientUrl() +
            "/api/data/v9.1/bah_keyvaluepairs?$select=bah_stringvalue_text&$filter=bah_name_text eq '" + keyName + "'&$top=1", false);
        req.setRequestHeader("OData-MaxVersion", "4.0");
        req.setRequestHeader("OData-Version", "4.0");
        req.send();
        if (req.status === 200) {
            var r = JSON.parse(req.response);
            return r.value.length > 0 ? r.value[0].bah_stringvalue_text : "";
        }
        return "";
    },

    GetActivityCount: function (entitySet, callback) {
        var req = new XMLHttpRequest();
        req.open("GET", parent.Xrm.Page.context.getClientUrl() +
            "/api/data/v9.1/" + entitySet + "s?$filter=_vhacrm_requestid_value eq " + IVDCompleteRequest.REQUEST.ID + "&$count=true", false);
        req.setRequestHeader("OData-MaxVersion", "4.0");
        req.setRequestHeader("OData-Version", "4.0");
        req.send();
        var count = 0;
        if (req.status === 200) {
            var r = JSON.parse(req.response);
            count = r["@odata.count"] || 0;
        }
        callback(count);
    },

    UpdateRecord: function (entitySet, id, data) {
        var req = new XMLHttpRequest();
        req.open("PATCH", parent.Xrm.Page.context.getClientUrl() + "/api/data/v9.1/" + entitySet + "s(" + id + ")", false);
        req.setRequestHeader("OData-MaxVersion", "4.0");
        req.setRequestHeader("OData-Version", "4.0");
        req.setRequestHeader("Content-Type", "application/json");
        req.send(JSON.stringify(data));
    },

    ExecuteWorkflow: function (workflowName, targetId) {
        var wfId = IVDCompleteRequest.GetWorkflowId(workflowName);
        if (!wfId) return;

        var payload = {
            Target: { "@odata.type": "Microsoft.Dynamics.CRM.incident", incidentid: targetId },
            WorkflowId: wfId
        };

        var req = new XMLHttpRequest();
        req.open("POST", parent.Xrm.Page.context.getClientUrl() + "/api/data/v9.1/ExecuteWorkflow", false);
        req.setRequestHeader("OData-MaxVersion", "4.0");
        req.setRequestHeader("OData-Version", "4.0");
        req.setRequestHeader("Content-Type", "application/json");
        req.send(JSON.stringify(payload));
    },

    GetWorkflowId: function (name) {
        var req = new XMLHttpRequest();
        req.open("GET", parent.Xrm.Page.context.getClientUrl() +
            "/api/data/v9.1/workflows?$select=workflowid&$filter=name eq '" + name + "' and statecode eq 1 and category eq 0&$top=1", false);
        req.setRequestHeader("OData-MaxVersion", "4.0");
        req.setRequestHeader("OData-Version", "4.0");
        req.send();
        if (req.status === 200) {
            var r = JSON.parse(req.response);
            return r.value.length > 0 ? r.value[0].workflowid : null;
        }
        return null;
    },

    ShowError: function (msg) {
        parent.Xrm.Page.ui.clearFormNotification("IVD_ERROR");
        parent.Xrm.Page.ui.setFormNotification(msg, "ERROR", "IVD_ERROR");
        IVDCompleteRequest.EnableDisableButton(); // re-enable button
    },

    EnableDisableButton: function (action) {
        document.getElementById("CompleteRequest").disabled = (action === "disable");
    }
};

// Auto-initialize when loaded as web resource
IVDCompleteRequest.init();