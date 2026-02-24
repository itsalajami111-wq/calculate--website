let chartInstance = null;

const $ = (id) => document.getElementById(id);

let selectedCurrency = "USD";

/**
 * Company branch currency rules (based on Country of Residence)
 * Only show currencies for locations where the company has branches.
 */
const branchCurrencyByCountry = {
  "United States": [{ code: "USD", label: "USD ($) - US Dollar" }],
  "Canada": [{ code: "CAD", label: "CAD ($) - Canadian Dollar" }],
  "United Kingdom": [{ code: "GBP", label: "GBP (£) - British Pound" }],
  "Australia": [{ code: "AUD", label: "AUD ($) - Australian Dollar" }],
  "Other": [{ code: "USD", label: "USD ($) - US Dollar" }]
};

function showError(msg){
  const box = $("errorBox");
  box.textContent = msg;
  box.style.display = "block";
}

function clearError(){
  const box = $("errorBox");
  box.textContent = "";
  box.style.display = "none";
}

function setCurrencyOptionsForCountry(country){
  const currencySelect = $("currency");
  const options = branchCurrencyByCountry[country] || [{ code: "USD", label: "USD ($) - US Dollar" }];

  currencySelect.innerHTML = ""; // clear

  for (const opt of options){
    const el = document.createElement("option");
    el.value = opt.code;
    el.textContent = opt.label;
    currencySelect.appendChild(el);
  }

  // auto-select first allowed currency
  selectedCurrency = options[0].code;
  currencySelect.value = selectedCurrency;
}

function money(n){
  if (!isFinite(n)) n = 0;
  return new Intl.NumberFormat("en-US", {
    style:"currency",
    currency: selectedCurrency,
    maximumFractionDigits: 0
  }).format(n);
}

function validateInputs(data){
  // Ages
  if (data.currentAge < 18 || data.currentAge > 100) return "Current age must be between 18 and 100.";
  if (data.retirementAge < 19 || data.retirementAge > 100) return "Retirement age must be between 19 and 100.";
  if (data.retirementAge <= data.currentAge) return "Retirement age must be greater than current age.";

  // Money
  const moneyFields = ["currentSavings","annualSalary","monthlyContribution"];
  for (const f of moneyFields){
    if (data[f] < 0) return "Money values cannot be negative.";
  }
  if (data.annualExpenses <= 0) return "Annual retirement expenses must be greater than 0.";

  // Percent ranges
  if (data.annualReturn < 0 || data.annualReturn > 30) return "Expected annual return must be between 0% and 30%.";
  if (data.inflationRate < 0 || data.inflationRate > 15) return "Expected inflation rate must be between 0% and 15%.";

  // Years in retirement
  if (data.yearsInRetirement < 1 || data.yearsInRetirement > 50) return "Expected years in retirement must be between 1 and 50.";

  // Contact (simple checks)
  if (!data.firstName.trim() || !data.lastName.trim()) return "Please enter your first name and last name.";
  if (!data.email.includes("@")) return "Please enter a valid email address.";
  if (!data.country) return "Please select your country.";
  if (!data.phone.trim()) return "Please enter your phone number.";

  // Currency must be one of the allowed branch currencies
  const allowed = (branchCurrencyByCountry[data.country] || branchCurrencyByCountry["Other"]).map(o => o.code);
  if (!allowed.includes(data.currency)) return "Currency is not available for the selected country.";

  return null;
}

/**
 * Core calculation (unchanged):
 * - Accumulation: yearly compounding + contributions
 * - Retirement: inflation-adjust expenses, then yearly drawdown with growth
 * - Annual Income: 4% rule from total at retirement
 */
function calculateRetirement(data){
  const yearsToRetirement = data.retirementAge - data.currentAge;

  const r = data.annualReturn / 100;
  const infl = data.inflationRate / 100;

  const annualTotalContribution = data.monthlyContribution * 12;

  // Projection arrays
  const ages = [];
  const balances = [];

  // --- Accumulation phase ---
  let balance = data.currentSavings;

  for (let i = 0; i <= yearsToRetirement; i++){
    const age = data.currentAge + i;

    ages.push(age);
    balances.push(balance);

    if (i < yearsToRetirement){
      balance = balance * (1 + r) + annualTotalContribution;
    }
  }

  const totalAtRetirement = balance;

  // 4% rule
  const annualIncome = totalAtRetirement * 0.04;

  // Inflation-adjust annual expenses to retirement start
  const expensesAtRetirement = data.annualExpenses * Math.pow(1 + infl, yearsToRetirement);

  // --- Retirement phase projection ---
  const retireAges = [];
  const retireBalances = [];

  let retireBalance = totalAtRetirement;
  for (let y = 1; y <= data.yearsInRetirement; y++){
    const age = data.retirementAge + y;
    retireAges.push(age);

    const expenseThisYear = expensesAtRetirement * Math.pow(1 + infl, y - 1);

    retireBalance = retireBalance * (1 + r) - expenseThisYear;

    retireBalances.push(Math.max(0, retireBalance));
  }

  return {
    yearsToRetirement,
    totalAtRetirement,
    annualIncome,
    ages,
    balances,
    retireAges,
    retireBalances
  };
}

function buildAnalysis(data, results){
  const monthlyIncome = results.annualIncome / 12;

  const p1 =
    `Based on your current plan, you're projected to have ${money(results.totalAtRetirement)} by age ${data.retirementAge}. ` +
    `This would provide approximately ${money(monthlyIncome)} per month in retirement income using the 4% withdrawal rule.`;

  const annualContribution = data.monthlyContribution * 12;
  const savingsRate = data.annualSalary > 0 ? (annualContribution / data.annualSalary) * 100 : 0;

  const p2 =
    `With ${results.yearsToRetirement} years until retirement and your current savings rate of ${savingsRate.toFixed(0)}%, ` +
    `continue to prioritize your financial well-being!`;

  return { p1, p2 };
}

function renderChart(results){
  const ctx = $("projectionChart");
  const labels = [...results.ages, ...results.retireAges];

  const accData = labels.map((age) => {
    const idx = results.ages.indexOf(age);
    return idx >= 0 ? results.balances[idx] : null;
  });

  const retData = labels.map((age) => {
    const idx = results.retireAges.indexOf(age);
    return idx >= 0 ? results.retireBalances[idx] : null;
  });

  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Accumulation Phase",
          data: accData,
          borderColor: "#2AA7A1",
          backgroundColor: "rgba(42,167,161,0.15)",
          fill: true,
          tension: 0.35,
          spanGaps: true
        },
        {
          label: "Retirement Phase",
          data: retData,
          borderColor: "#E06B5A",
          backgroundColor: "rgba(224,107,90,0.15)",
          fill: true,
          tension: 0.35,
          spanGaps: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${money(ctx.raw || 0)}`
          }
        }
      },
      scales: {
        y: {
          ticks: {
            callback: (val) => {
              const n = Number(val);
              if (n >= 1000) {
                const k = Math.round(n / 1000);
                const symbol = money(0).replace(/[0-9.,\s]/g, "");
                return `${symbol}${k}k`;
              }
              return money(n);
            }
          }
        }
      }
    }
  });
}

async function sendLeadToBackend(payload){
  try{
    await fetch("/api/lead", {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify(payload)
    });
  }catch(e){
    // ignore
  }
}

// When country changes, update allowed currency list
$("country").addEventListener("change", () => {
  const country = $("country").value || "Other";
  setCurrencyOptionsForCountry(country);
});

// Initialize currency list on page load (based on current country)
document.addEventListener("DOMContentLoaded", () => {
  const country = $("country").value || "Other";
  setCurrencyOptionsForCountry(country);
});

$("retirementForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  clearError();

  // Use currently selected allowed currency
  selectedCurrency = $("currency").value || selectedCurrency;

  const data = {
    currentAge: Number($("currentAge").value),
    retirementAge: Number($("retirementAge").value),
    currentSavings: Number($("currentSavings").value),
    annualSalary: Number($("annualSalary").value),
    monthlyContribution: Number($("monthlyContribution").value),
    annualReturn: Number($("annualReturn").value),
    inflationRate: Number($("inflationRate").value),
    annualExpenses: Number($("annualExpenses").value),
    yearsInRetirement: Number($("yearsInRetirement").value),

    currency: selectedCurrency,

    firstName: $("firstName").value,
    lastName: $("lastName").value,
    email: $("email").value,
    country: $("country").value,
    phoneCode: $("phoneCode").value,
    phone: $("phone").value
  };

  const err = validateInputs(data);
  if (err){
    showError(err);
    return;
  }

  const results = calculateRetirement(data);
  const analysis = buildAnalysis(data, results);

  $("totalAtRetirement").textContent = money(results.totalAtRetirement);
  $("annualIncome").textContent = money(results.annualIncome);
  $("yearsToRetirement").textContent = String(results.yearsToRetirement);
  $("analysisP1").textContent = analysis.p1;
  $("analysisP2").textContent = analysis.p2;

  renderChart(results);

  $("viewForm").classList.add("hidden");
  $("viewResults").classList.remove("hidden");

  await sendLeadToBackend({ data, results });
});

$("backBtn").addEventListener("click", () => {
  $("viewResults").classList.add("hidden");
  $("viewForm").classList.remove("hidden");
});
