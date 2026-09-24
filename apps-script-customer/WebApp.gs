function doGet() {
  return HtmlService.createTemplateFromFile('Availability').evaluate().setTitle('空き状況')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}
