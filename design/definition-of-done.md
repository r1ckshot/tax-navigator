# Definition of Done

- [ ] Pencil connected і відкрив `design/sources.pen`, перевірено read-only промптом до генерації.
- [ ] Є desktop frame 1440px.
- [ ] Є mobile frame 390px.
- [ ] Рядок правила і бейдж стану — components/instances, не скопійовані кадри.
- [ ] Variables полотна взяті з ролей `app/globals.css`, не з палітри.
- [ ] Стани default і stale показані; unavailable, loading, error, disabled позначені N/A.
- [ ] Design затверджений Mike до implementation.
- [ ] Реалізація живе маршрутом `/sources` і перевикористовує наявні компоненти.
- [ ] `SourceCitation` у картках результату не зламаний.
- [ ] `tsc --noEmit`, `npm test`, `npm run test:ui`, `npm run verify` зелені. `next build` у контейнері не запускаємо, збірку валідує Vercel.
- [ ] Desktop і mobile перевірені в браузері: Mike або візуальний харнес на раннері.
- [ ] `git diff --stat` містить лише очікуваний scope.
