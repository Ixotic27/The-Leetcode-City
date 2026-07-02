class DeveloperAchievement(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    developer_id = db.Column(db.Integer, db.ForeignKey('developer.id'), nullable=False)
    achievement_id = db.Column(db.Integer, db.ForeignKey('achievement.id'), nullable=False)
    unlocked_at = db.Column(db.DateTime, nullable=False, default=db.func.current_timestamp())
    __table_args__ = (db.UniqueConstraint('developer_id', 'achievement_id'),)