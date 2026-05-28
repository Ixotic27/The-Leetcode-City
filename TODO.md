- [ ] Update src/app/page.tsx to prevent action buttons from rendering until identity resolution is complete
- [ ] Fix isOwnBuilding to compare only LeetCode usernames (linkedLeetCodeUsername + selectedBuilding.login)
- [ ] Introduce an explicit identityResolved flag derived from session + linkedLeetCodeUsername fetch
- [ ] Gate action-button sections (kudos/gift/battle/compare if needed) behind identityResolved to remove flicker
- [ ] Verify no visual/logic regressions for other users
- [ ] Provide a clean diff/patch of the changes

