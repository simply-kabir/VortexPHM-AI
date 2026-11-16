from math import erf, sqrt

# ASSUMPTIONS — replace with numbers you can justify (brief cites $150K–$1.2M per UER/IFSD event)
COST_UER, COST_INSPECTION, DEFER_HORIZON = 450_000, 15_000, 30


def p_fail_within(rul: float, sigma: float, horizon: int = DEFER_HORIZON) -> float:
    return 0.5 * (1 + erf((horizon - rul) / (max(sigma, 1e-6) * sqrt(2))))


def cost_benefit(rul: float, sigma: float) -> dict:
    p = p_fail_within(rul, sigma)
    exp_defer = p * COST_UER
    return dict(p_fail_within_horizon=round(p, 3), horizon_cycles=DEFER_HORIZON,
                expected_cost_defer=round(exp_defer), cost_act_now=COST_INSPECTION,
                suggestion="ACT_NOW" if exp_defer > COST_INSPECTION else "MONITOR",
                note="Assumption-based; edit constants in cost_model.py")
