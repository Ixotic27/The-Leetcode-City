from the_leetcode_city import db

class Achievement(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(200), nullable=False)
    category = db.Column(db.String(50), nullable=False)
    threshold = db.Column(db.Integer, nullable=False)
    unlocked = db.Column(db.Boolean, nullable=False, default=False)

    def __repr__(self):
        return f"Achievement('{self.name}', '{self.description}')"