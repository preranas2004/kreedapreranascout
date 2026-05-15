# Security Specification for Kreeda-Prerana Scout

## 1. Data Invariants
- A teacher can only read/write their own profile.
- A teacher can only manage athletes and trials that belong to them (nested under their UID).
- Athletes must have a name, age, and sport.
- Trials must have a type, value, and timestamp.
- Profile pictures must be valid strings (URLs).

## 2. The "Dirty Dozen" Payloads (Rejected)
1. Write to another teacher's profile.
2. Read athletes of another teacher.
3. Create an athlete with a negative age.
4. Create an athlete with an extremely long name (>1KB).
5. Inject an 'isAdmin' field into teacher profile.
6. Delete another teacher's trial.
7. Update trial value to a string.
8. Create an athlete without being logged in.
9. Spoof `userId` in the payload that doesn't match authenticated UID.
10. Update `createdAt` timestamp to a future date manually.
11. List all athletes across all teachers (blanket read).
12. Inject 2MB of garbage data into a profile picture URL field.

## 3. Test Runner
(I'll focus on generating the secure rules directly as per instructions).
