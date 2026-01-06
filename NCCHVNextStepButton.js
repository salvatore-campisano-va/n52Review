// NCCHVNextStepButton.js
function onNextStepButtonClick(executionContext) {
    // Get form context
    var formContext = executionContext.getFormContext();

    // Initialize variables
    var vType = "";
    var vArea = "";
    var vFacility = "";
    var vVeteran = "";
    var vCaseNote = "";
    var vVeteranOutcome = "";

    // Check if actionintersectionid is populated
    if (!formContext.getAttribute("vhacrm_actionintersectionid").getValue()) {
        Xrm.Utility.alertDialog("Please select an Action before continuing.");
        return;
    }

    // Check if current user is the owner
    var currentUserId = Xrm.Utility.getGlobalContext().userSettings.userId.replace(/[{}]/g, "").toLowerCase();
    var ownerId = formContext.getAttribute("ownerid").getValue()[0].id.replace(/[{}]/g, "").toLowerCase();
    if (currentUserId !== ownerId) {
        Xrm.Utility.alertDialog("You must pick the request from the queue before proceeding.");
        return;
    }

    // Validation checks
    if (!formContext.getAttribute("vhacrm_areaintersectionid").getValue()) {
        vArea = "Area is required to resolve a Request.";
    }
    if (!formContext.getAttribute("vhacrm_facilityid").getValue()) {
        vFacility = "Facility is required to resolve a Request.";
    }
    if (!formContext.getAttribute("vhacrm_typeintersectionid").getValue()) {
        vType = "Type is required to resolve a Request.";
    }
    if (!formContext.getAttribute("customerid").getValue()) {
        vVeteran = "Veteran is required to resolve a Request.";
    }

    // Check for Veteran Outcome (specific to actionintersectionid = '17B9364F-7A17-E611-811E-127B25DCBDE7')
    var actionId = formContext.getAttribute("vhacrm_actionintersectionid").getValue()[0].id.replace(/[{}]/g, "").toUpperCase();
    if (actionId === "17B9364F-7A17-E611-811E-127B25DCBDE7") {
        checkVeteranOutcome(formContext, function (hasOutcome) {
            if (!hasOutcome) {
                vVeteranOutcome = "At least one Veteran Outcome must be selected";
                proceedWithLogic(formContext, vType, vArea, vFacility, vVeteran, vCaseNote, vVeteranOutcome);
            } else {
                checkCaseNote(formContext, function (hasCaseNote) {
                    if (!hasCaseNote && !formContext.getAttribute("vhacrm_casenotes_memo").getValue()) {
                        vCaseNote = "Please enter a Case Note before proceeding with action.";
                    }
                    proceedWithLogic(formContext, vType, vArea, vFacility, vVeteran, vCaseNote, vVeteranOutcome);
                });
            }
        });
    } else {
        checkCaseNote(formContext, function (hasCaseNote) {
            if (!hasCaseNote && !formContext.getAttribute("vhacrm_casenotes_memo").getValue()) {
                vCaseNote = "Please enter a Case Note before proceeding with action.";
            }
            proceedWithLogic(formContext, vType, vArea, vFacility, vVeteran, vCaseNote, vVeteranOutcome);
        });
    }
}

function checkVeteranOutcome(formContext, callback) {
    var incidentId = formContext.data.entity.getId().replace(/[{}]/g, "");
    var fetchXml = `
        <fetch top="1">
            <entity name="vhacrm_veteranoutcome">
                <attribute name="vhacrm_ispopulated_bool" />
                <filter>
                    <condition attribute="vhacrm_requestid" operator="eq" value="${incidentId}" />
                    <condition attribute="vhacrm_ispopulated_bool" operator="eq" value="1" />
                </filter>
            </entity>
        </fetch>`;

    Xrm.WebApi.retrieveMultipleRecords("vhacrm_veteranoutcome", "?fetchXml=" + encodeURIComponent(fetchXml)).then(
        function (result) {
            callback(result.entities.length > 0);
        },
        function (error) {
            Xrm.Utility.alertDialog("Error checking Veteran Outcome: " + error.message);
            callback(false);
        }
    );
}

function checkCaseNote(formContext, callback) {
    var incidentId = formContext.data.entity.getId().replace(/[{}]/g, "");
    var ownerId = formContext.getAttribute("ownerid").getValue()[0].id.replace(/[{}]/g, "");
    var fetchXml = `
        <fetch top="1">
            <entity name="vhacrm_casenote">
                <attribute name="vhacrm_name" />
                <filter>
                    <condition attribute="vhacrm_requestid" operator="eq" value="${incidentId}" />
                    <condition attribute="createdby" operator="eq" value="${ownerId}" />
                </filter>
            </entity>
        </fetch>`;

    Xrm.WebApi.retrieveMultipleRecords("vhacrm_casenote", "?fetchXml=" + encodeURIComponent(fetchXml)).then(
        function (result) {
            callback(result.entities.length > 0);
        },
        function (error) {
            Xrm.Utility.alertDialog("Error checking Case Note: " + error.message);
            callback(false);
        }
    );
}

function proceedWithLogic(formContext, vType, vArea, vFacility, vVeteran, vCaseNote, vVeteranOutcome) {
    // Check if all validations pass
    var hasInfo = vType === "" && vArea === "" && vFacility === "" && vVeteran === "" && vCaseNote === "" && vVeteranOutcome === "" ? "yes" : "no";

    if (hasInfo === "yes") {
        // Save Case Note if vhacrm_casenotes_memo is populated
        if (formContext.getAttribute("vhacrm_casenotes_memo").getValue()) {
            createCaseNote(formContext, function () {
                // Trigger save and close
                formContext.data.entity.save("saveandclose");
            });
        } else {
            // No case note to save, proceed with save and close
            formContext.data.entity.save("saveandclose");
        }
    } else {
        // Format and display error notifications
        var errorMessage = "";
        if (vArea) errorMessage += `|${vArea},ERROR,en`;
        if (vFacility) errorMessage += `|${vFacility},ERROR,ev`;
        if (vType) errorMessage += `|${vType},ERROR,ra`;
        if (vVeteran) errorMessage += `|${vVeteran},ERROR,ma`;
        if (vCaseNote) errorMessage += `|${vCaseNote},ERROR,acm`;
        if (vVeteranOutcome) errorMessage += `|${vVeteranOutcome},ERROR,dim`;

        if (errorMessage) {
            errorMessage = "notify" + errorMessage;
            // Display errors (modify based on how Dynamics 365 handles notifications in your environment)
            Xrm.Utility.alertDialog(errorMessage.replace(/\|/g, "\n"));
        }
    }
}

function createCaseNote(formContext, callback) {
    var notename = "";
    if (formContext.getAttribute("vhacrm_lobid").getValue()) {
        notename = formContext.getAttribute("vhacrm_lobid").getValue()[0].name;
    }
    if (formContext.getAttribute("vhacrm_typeintersectionid").getValue()) {
        notename += "/" + formContext.getAttribute("vhacrm_typeintersectionid").getValue()[0].name;
    }
    if (formContext.getAttribute("vhacrm_areaintersectionid").getValue()) {
        notename += "/" + formContext.getAttribute("vhacrm_areaintersectionid").getValue()[0].name;
    }
    if (formContext.getAttribute("vhacrm_subareaintersectionid").getValue()) {
        notename += "/" + formContext.getAttribute("vhacrm_subareaintersectionid").getValue()[0].name;
    }

    var caseNote = {
        "vhacrm_name": notename,
        "vhacrm_casenotes_memo": formContext.getAttribute("vhacrm_casenotes_memo").getValue(),
        "vhacrm_requestid@odata.bind": `/incidents(${formContext.data.entity.getId().replace(/[{}]/g, "")})`,
        "vhacrm_veteranid@odata.bind": `/contacts(${formContext.getAttribute("customerid").getValue()[0].id.replace(/[{}]/g, "")})`,
        "vhacrm_casenotetemplateid@odata.bind": `/vhacrm_casenotetemplates(${formContext.getAttribute("vhacrm_casenotetemplateid").getValue()[0].id.replace(/[{}]/g, "")})`,
        "vhacrm_casenotetype_code": 168790000
    };

    Xrm.WebApi.createRecord("vhacrm_casenote", caseNote).then(
        function (result) {
            callback();
        },
        function (error) {
            Xrm.Utility.alertDialog("Error creating Case Note: " + error.message);
        }
    );
}