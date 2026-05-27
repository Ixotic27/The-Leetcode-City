self.addEventListener("push", function (event) {
  const data = event.data ? event.data.json() : {};

  const title = data.title || "Notification";
  const options = {
    body: data.body || "You have a new update",
    icon: "/icon-192.png",
  };

  event.waitUntil(self.registration.showNotification(title, options));
});
