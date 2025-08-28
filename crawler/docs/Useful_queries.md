# Useful SQL queries

## Progress over time

```sql
SELECT COUNT(*), HOUR(finished) AS h, DATE(finished) AS d FROM pages GROUP BY d,h
```
