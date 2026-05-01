# Security Specification - NexusFlow

## 1. Data Invariants
- A **User** must belong to exactly one **Company**.
- A **Contact** must belong to the same **Company** as the user who created it (or who is managing it).
- **Outreach History** belongs to a **Contact** which belongs to a **Company**.
- Access to any resource (Contact, Outreach) is strictly gated by the user's membership in the associated **Company**.
- Users can only create their own profile in `/users/{userId}`.
- First user of a domain can create a **Company** record.

## 2. The "Dirty Dozen" Payloads (Attack Vectors)

1. **Identity Spoofing (Create User)**: Attempt to create `/users/attackerId` with `uid: 'victimId'`.
2. **Identity Spoofing (Read User)**: authenticated user `A` tries to read `/users/B` where `B` is in a different company.
3. **Company Hijacking**: User `A` tries to update `role` to `admin` in their own `/users/A` document.
4. **Cross-Tenant Contact Creation**: User `A` (Company `X`) tries to create a contact in `/companies/Y/contacts/C`.
5. **Cross-Tenant Contact Read**: User `A` (Company `X`) tries to read a contact in `/companies/Y/contacts/C`.
6. **Shadow Update (Contact)**: User `A` tries to update a contact but injects `isVerified: true` (a ghost field).
7. **Privilege Escalation**: Non-admin user tries to delete a contact.
8. **Resource Poisoning (Contact ID)**: Attempt to create a contact with a 2MB string as the ID.
9. **Unverified Email Access**: User with `email_verified: false` tries to read contacts.
10. **Immutable Field Poisoning**: User tries to change several fields in `outreach` records that should be immutable (like `createdAt`).
11. **Orphaned Contact**: Attempt to create a contact with a non-existent `companyId`.
12. **PII Leak**: Non-member of a company tries to list users of that company to scrape emails.

## 3. Conflict Report & Pillar Evaluation

| Collection | Identity Spoofing | State Shortcutting | Resource Poisoning |
| :--- | :--- | :--- | :--- |
| `/users` | Blocked (uid != userId) | N/A | ID validation |
| `/companies` | Blocked (isSameCompany) | Role check for updates | ID validation |
| `/contacts` | Blocked (createdBy check) | Action-based update needed | ID validation |

## 4. Pillar Assessment
1. **Master Gate**: Partial. Uses `isSameCompany` but needs `get()` on parent company in some writes.
2. **Validation Blueprints**: Missing. Needs `isValidContact` helper inside `allow`.
3. **Path Variable Hardening**: Partial. `isValidId` is defined but not everywhere.
4. **Tiered Identity**: Missing. Admin role exists but not used for granular field updates.
5. **Array Guarding**: N/A (no arrays used yet).
6. **PII Isolation**: Users collection contains email. Needs read restrictions.
7. **existsAfter**: Needed for transactional sync (e.g. outreach count).
8. **Secure List Queries**: Missing. `allow list` doesn't check `resource.data` properly everywhere.
