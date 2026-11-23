"""An offline security-rubric adapter for the JavaScript data-types lesson."""

from __future__ import annotations

from dataclasses import asdict, dataclass
import json
from typing import Callable, Iterable


COMPATIBLE_CONTROLS = {
    "numeric_coercion": "numeric_validation",
    "unsafe_string_rendering": "text_only_rendering",
    "truthy_string_boolean": "strict_boolean_parsing",
}


@dataclass(frozen=True)
class Scenario:
    scenario_id: str
    lesson_concept: str
    asset: str
    threat_category: str
    threat: str
    control_category: str
    control: str
    residual_risk: str


@dataclass(frozen=True)
class Assessment:
    scenario_id: str
    status: str
    findings: tuple[str, ...] = ()


# Any future service must implement this callable contract. The example uses
# only the deterministic local function below.
ReviewAdapter = Callable[[Scenario], Assessment]


def offline_rubric_adapter(scenario: Scenario) -> Assessment:
    """Return a deterministic structural result without network access."""
    required = {
        "asset": scenario.asset,
        "threat": scenario.threat,
        "control": scenario.control,
        "residual_risk": scenario.residual_risk,
    }
    missing = tuple(name for name, value in required.items() if not value.strip())
    if missing:
        return Assessment(
            scenario_id=scenario.scenario_id,
            status="FAIL",
            findings=tuple(f"missing {name}" for name in missing),
        )

    expected = COMPATIBLE_CONTROLS.get(scenario.threat_category)
    if expected != scenario.control_category:
        return Assessment(
            scenario_id=scenario.scenario_id,
            status="REVIEW",
            findings=("declared control category does not match the threat category",),
        )

    return Assessment(scenario_id=scenario.scenario_id, status="PASS")


def review_scenario(scenario: Scenario, adapter: ReviewAdapter) -> Assessment:
    """Invoke the injected review implementation through one callable seam."""
    return adapter(scenario)


def review_all(
    scenarios: Iterable[Scenario], adapter: ReviewAdapter = offline_rubric_adapter
) -> list[Assessment]:
    return [review_scenario(scenario, adapter) for scenario in scenarios]


SCENARIOS = (
    Scenario(
        scenario_id="balance-number",
        lesson_concept="numbers",
        asset="a balance received as a JavaScript number",
        threat_category="numeric_coercion",
        threat="a numeric string is concatenated instead of added",
        control_category="numeric_validation",
        control="convert input to a finite number before arithmetic",
        residual_risk="floating-point rounding may still affect decimal currency",
    ),
    Scenario(
        scenario_id="profile-string",
        lesson_concept="strings",
        asset="a profile name stored as a JavaScript string",
        threat_category="unsafe_string_rendering",
        threat="untrusted text is interpreted as HTML when displayed",
        control_category="text_only_rendering",
        control="render the value as text and enforce an appropriate length",
        residual_risk="look-alike Unicode characters can still confuse readers",
    ),
    Scenario(
        scenario_id="consent-boolean",
        lesson_concept="booleans",
        asset="a consent choice represented as a JavaScript boolean",
        threat_category="truthy_string_boolean",
        threat="the string false is truthy and accidentally enables a feature",
        control_category="strict_boolean_parsing",
        control="accept only an explicit boolean and default to false",
        residual_risk="a valid true value does not prove the user understood the choice",
    ),
)


def main() -> None:
    print(json.dumps([asdict(item) for item in review_all(SCENARIOS)], indent=2))


if __name__ == "__main__":
    main()
