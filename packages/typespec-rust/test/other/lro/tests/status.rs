use azure_core::http::poller::{PollerStatus, StatusMonitor};
use lro::models::{NIClientBeginCustomLinkOperationStatus, OperationState};

#[test]
fn unknown_status_strings_are_preserved_and_terminal_strings_ignore_ascii_case() {
    for (wire_status, expected) in [
        ("Running", PollerStatus::UnknownValue("Running".to_owned())),
        (
            "future-state",
            PollerStatus::UnknownValue("future-state".to_owned()),
        ),
        ("sUcCeEdEd", PollerStatus::Succeeded),
        ("cAnCeLlEd", PollerStatus::Canceled),
    ] {
        let value = format!(r#"{{"status":"{wire_status}"}}"#);
        let monitor: NIClientBeginCustomLinkOperationStatus =
            azure_core::json::from_json(value.as_bytes()).unwrap();

        if wire_status == "Running" {
            assert!(matches!(monitor.status, Some(OperationState::Running)));
        } else {
            assert!(matches!(
                monitor.status,
                Some(OperationState::UnknownValue(_))
            ));
        }
        assert_eq!(monitor.status(), expected, "wire status {wire_status}");
    }
}
