// Importato per primo dai test: chiavi FINTE perché i moduli che creano il client Stripe all'avvio possano essere caricati.
// Nessuna chiamata a Stripe viene fatta nei test.
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_finto_nessuna_chiamata';
