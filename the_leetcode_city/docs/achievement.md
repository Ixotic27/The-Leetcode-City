# Achievement System

The achievement system is designed to reward developers for their contributions to the platform.

## Achievements

Achievements are defined in the `achievement` table and can be unlocked by developers based on their progress.

### Contribution Achievements

Contribution achievements are unlocked based on the number of contributions made by a developer.

### Repository Achievements

Repository achievements are unlocked based on the number of repositories created by a developer.

### Star Achievements

Star achievements are unlocked based on the number of stars received by a developer's repositories.

### Referral Achievements

Referral achievements are unlocked based on the number of referrals made by a developer.

### Gift Achievements

Gift achievements are unlocked based on the number of gifts sent and received by a developer.

### Kudo Achievements

Kudo achievements are unlocked based on the number of kudos received by a developer.

## Unlocking Achievements

Achievements can be unlocked by developers based on their progress. The `achievement_service` is responsible for evaluating a developer's progress and unlocking achievements when milestone thresholds are reached.

## Activity Feed

The `activity_feed` table is used to store records of achievements unlocked by developers. This allows developers to track their progress and see which achievements they have unlocked.

## Tests

The achievement system is tested using unit tests and integration tests. These tests cover various scenarios and edge cases to ensure the system is working correctly.