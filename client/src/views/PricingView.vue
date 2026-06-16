<template>
  <div class="max-w-screen-xl mx-auto px-4 py-8 space-y-8">
    <div class="text-center space-y-2">
      <h1 class="text-3xl font-bold text-gray-900">Pricing</h1>
      <p class="text-sm text-gray-600">
        Planes oficiales para desarrolladores con demasiado presupuesto.
      </p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <article class="bg-white border border-gray-200 rounded-lg p-5 shadow-sm space-y-4">
        <header class="space-y-1">
          <h2 class="text-lg font-semibold text-gray-900">Starter Nada</h2>
          <p class="text-3xl font-bold text-gray-900">
            19,99€<span class="text-base font-medium text-gray-500"> / mes</span>
          </p>
        </header>

        <ul class="text-sm text-gray-600 space-y-1">
          <li>Sin ventajas.</li>
          <li>Sin soporte.</li>
          <li>Sin verguenza.</li>
        </ul>

        <button class="w-full px-3 py-2 text-sm rounded bg-gray-900 text-white hover:bg-black transition-colors">
          Elegir plan
        </button>
      </article>

      <article class="bg-white border-2 border-blue-300 rounded-lg p-5 shadow-sm space-y-4">
        <header class="space-y-1">
          <p class="inline-flex text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">
            Más caro, mismo humo
          </p>
          <h2 class="text-lg font-semibold text-gray-900">Pro Nada Plus</h2>
          <p class="text-3xl font-bold text-gray-900">
            49,99€<span class="text-base font-medium text-gray-500"> / mes</span>
          </p>
        </header>

        <ul class="text-sm text-gray-600 space-y-1">
          <li>Las mismas ventajas que Starter Nada.</li>
          <li>Es decir: ninguna.</li>
          <li>Pero queda mejor en la factura.</li>
        </ul>

        <button class="w-full px-3 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors">
          Elegir plan
        </button>
      </article>

      <article class="bg-white border border-green-300 rounded-lg p-5 shadow-sm space-y-4">
        <header class="space-y-1">
          <h2 class="text-lg font-semibold text-gray-900">Enterprise Todo</h2>
          <p class="text-3xl font-bold text-gray-900">
            99,99€<span class="text-base font-medium text-gray-500"> / mes</span>
          </p>
        </header>

        <ul class="text-sm text-gray-600 space-y-1">
          <li>Todas las ventajas de la app.</li>
          <li>Más una falsa sensación de control.</li>
          <li>Y un extra de ego técnico.</li>
        </ul>

        <button class="w-full px-3 py-2 text-sm rounded bg-green-600 text-white hover:bg-green-700 transition-colors">
          Elegir plan
        </button>
      </article>
    </div>
  </div>
</template>
