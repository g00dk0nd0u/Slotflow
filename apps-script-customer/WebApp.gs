function doGet() {
  return HtmlService.createTemplateFromFile('Booking').evaluate().setTitle('ご予約')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}
