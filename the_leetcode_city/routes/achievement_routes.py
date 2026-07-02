def _unlock_achievement(developer_id, achievement):
    # ...
    activity_feed = ActivityFeed(developer_id=developer_id, achievement_id=achievement.id)
    db.session.add(activity_feed)
    db.session.commit()