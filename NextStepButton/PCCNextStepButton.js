$(document).ready(function () {
    $("#NextStep").click(async function () {
        const $button = $(this);
        
        // Prevent double-clicks
        if ($button.hasClass("btn-loading")) {
            return;
        }

        try {
            setButtonLoading($button, true);
            await executeRequestValidationAndAction();
        } catch (error) {
            console.error("Error in NextStep click handler:", error);
            showAlert("An unexpected error occurred. Please try again.");
        } finally {
            setButtonLoading($button, false);
        }
    });
});

// Get parent Xrm if possible
function getXrm() {
    return parent.Xrm || Xrm;
}

// Show alert dialog
function showAlert(message, title = "Alert") {
    const xrm = getXrm();
    
    // Use modern alertDialog if available
    if (xrm.Navigation && xrm.Navigation.openAlertDialog) {
        return xrm.Navigation.openAlertDialog({ text: message, title: title });
    }
    // Fallback to deprecated method
    return xrm.Utility.alertDialog(message);
}

function setButtonLoading($button, isLoading) {
    if (isLoading) {
        $button.addClass("btn-loading");
        $button.find(".button-text").text("Processing next step...");
        $button.find(".spinner-border").removeClass("d-none");
    } else {
        $button.removeClass("btn-loading");
        $button.find(".button-text").text("Next Step");
        $button.find(".spinner-border").addClass("d-none");
    }
}

async function executeRequestValidationAndAction() {
    // Get form context
    const xrm = getXrm();
    const formContext = xrm.Page;

    // Get current user ID
    const currentUserId = cleanGuid(xrm.Utility.getGlobalContext().userSettings.userId);

    // Check if vhacrm_actionintersectionid has data
    const actionIntersectionId = formContext.getAttribute("vhacrm_actionintersectionid").getValue();
    if (!actionIntersectionId) {
        showAlert("Please select an Action before continuing.", "Missing Action");
        return;
    }

    // Check if current user is the owner of the incident
    const ownerId = formContext.getAttribute("ownerid").getValue()[0].id.toLowerCase().replace(/[{}]/g, "");
    if (currentUserId.toLowerCase() !== ownerId) {
        showAlert("You must pick the request from the queue before proceeding.", "Incorrect Request Owner");
        return;
    }

    // Run validation checks
    const validationErrors = [];

    if (!formContext.getAttribute("vhacrm_typeintersectionid")?.getValue()) {
        validationErrors.push("Type is required to resolve a Request.");
    }

    if (!formContext.getAttribute("vhacrm_areaintersectionid")?.getValue()) {
        validationErrors.push("Area is required to resolve a Request.");
    }

    if (!formContext. getAttribute("vhacrm_facilityid")?.getValue()) {
        validationErrors.push("Facility is required to resolve a Request.");
    }

    if (!formContext.getAttribute("vhacrm_facilitypharmacyid")?.getValue()) {
        validationErrors.push("Facility Pharmacy is required to resolve a Request.");
    }

    const customerValue = formContext.getAttribute("customerid")?.getValue();
    if (!customerValue || customerValue.length === 0) {
        validationErrors.push("Veteran is required to resolve a Request.");
    }

    const incidentId = cleanGuid(formContext.data.entity.getId());
    const caseNotesMemo = formContext.getAttribute("vhacrm_casenotes_memo")?.getValue();
    const caseNoteExists = await checkCaseNoteExists(incidentId, ownerId);

    if (!caseNotesMemo && !caseNoteExists) {
        validationErrors.push("Please enter a Case Note before proceeding with action.");
    }

    // Check if all validations passed
    if (validationErrors.length > 0) {
        const errorMessage = "Please correct the following:\n• " + validationErrors.join("\n• ");
        await showAlert(errorMessage, "Validation Errors");
        return;
    }

    // All validations passed - proceed with actions
    if (caseNotesMemo) {
        const noteName = buildCaseNoteName(formContext);
        const veteranId = cleanGuid(customerValue[0].id);
        const templateValue = formContext.getAttribute("vhacrm_casenotetemplateid")?.getValue();
        const templateId = templateValue ? templateValue[0].id : null;

        await createCaseNote(noteName, caseNotesMemo, incidentId, veteranId, templateId);
    }

    // Update Next Action bool to activate workflow PCC - Initiate Next Action
    Xrm.Page.data.entity.attributes.get("vhacrm_onpccnextactionbutton")?.setValue(true);

    window.parent.Xrm.Page.data.entity.save("saveandclose");
}

// Helper function to check if a case note exists
async function checkCaseNoteExists(incidentId, ownerId) {
    const xrm = getXrm();
    const query = `?$select=vhacrm_name&$top=1&$filter=_vhacrm_requestid_value eq '${incidentId}' and _createdby_value eq '${ownerId}'`;
    try {
        const response = await xrm.WebApi.retrieveMultipleRecords("vhacrm_casenote", query);
        return response.entities. length > 0;
    } catch (error) {
        console.error("Error checking case note existence:", error);
        throw new Error("Failed to check for existing case notes.");
    }
}

// Helper function to create a case note
async function createCaseNote(name, memo, incidentId, veteranId, caseNoteTemplateId) {
    const xrm = getXrm();
    caseNoteTemplateId = cleanGuid(caseNoteTemplateId);
    const caseNote = {
        vhacrm_name: name,
        vhacrm_casenotes_memo: memo,
        "vhacrm_requestid@odata.bind": `/incidents(${incidentId})`,
        "vhacrm_veteranid@odata.bind": `/contacts(${veteranId})`,
        vhacrm_casenotetype_code: 168790000
    };

    if (caseNoteTemplateId) {
        caseNote["vhacrm_casenotetemplateid@odata.bind"] = `/vhacrm_casenotetemplates(${caseNoteTemplateId})`;
    }

    try {
        await xrm.WebApi.createRecord("vhacrm_casenote", caseNote);
    } catch (error) {
        console.error("Error creating case note:", error);
        throw new Error("Failed to create case note.");
    }
}

function cleanGuid(guid) {
    if (!guid) return "";
    return guid.replace(/[{}]/g, "").toLowerCase();
}