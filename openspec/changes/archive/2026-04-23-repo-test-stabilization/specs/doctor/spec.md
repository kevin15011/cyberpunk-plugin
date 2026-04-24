# Delta for doctor

## ADDED Requirements

### Requirement: Doctor Verification Fixture Isolation

Automated verification of doctor behavior MUST establish temporary HOME/config fixtures before loading HOME-sensitive doctor dependencies so diagnostic outcomes are deterministic and independent of suite execution order. Verification MUST NOT read or write the real user cyberpunk config path.

#### Scenario: Doctor tests load against prepared fixtures

- GIVEN doctor verification requires config- or HOME-derived inputs
- WHEN the test harness loads doctor behavior
- THEN the required temporary fixture state is created first
- AND doctor results are computed from that fixture state only

#### Scenario: Doctor verification is order-independent

- GIVEN another test file previously mutated HOME-related process state
- WHEN doctor verification runs in the same suite
- THEN it resets to its own isolated fixture inputs
- AND it produces the same pass/fail results as a standalone run
