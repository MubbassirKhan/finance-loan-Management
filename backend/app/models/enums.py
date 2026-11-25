"""Enumeration definitions for Documents and Loans."""
from enum import Enum


class DocTypeEnum(str, Enum):
    """Document category types (2 options)."""
    MEMBERSHIP = "Membership Application"
    LOAN_APPLICATION = "Loan Application"


class LoanTypeEnum(str, Enum):
    """Loan scheme and advance types (as specified in SP Office scheme)."""
    SOCIETY_PERSONAL_ADVANCE = "Society Personal Advance"
    HOUSING_ASSISTANCE_ADVANCE = "Housing Assistance Advance"
    EMERGENCY_MEDICAL_ADVANCE = "Emergency Medical Advance"
    FESTIVAL_ADVANCE = "Festival Advance"
    EDUCATION_ASSISTANCE_ADVANCE = "Education Assistance Advance"
