module.exports = {
  "min": values => Math.min.apply(this, values),
  "max": values => Math.max.apply(this, values),
  "median": values => {
    values.sort(function (a, b) {
      return a - b;
    });

    var half = Math.floor(values.length / 2);

    if (values.length % 2)
      return values[half];

    return (values[half - 1] + values[half]) / 2.0;
  }
}