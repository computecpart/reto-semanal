# Rifa verificable — MSI Passport

Cómo se sortea el equipo MSI (reglas 8 y 11) y cómo cualquiera puede comprobarlo.

## Antes del sorteo
1. El superadmin abre **Admin → Rifa** y publica la **lista de elegibles**: identificadores MSI Passport
   ordenados y separados por comas. También publica su **huella SHA-256**.
2. Son elegibles los participantes con rol `participant`, perfil completo y estado distinto de
   «descalificado» o «archivado». Los puntos **no** cambian las probabilidades.

## Durante el sorteo
3. Se anuncia una **semilla pública** que nadie conoce de antemano. Por ejemplo, el número ganador de la lotería de
   ese día, o un número dicho en vivo por el público.
4. Se pulsa **Sortear**. El resultado queda registrado de forma inmutable con la semilla, la huella y el número
   de elegibles.

## Algoritmo (idéntico en PostgreSQL y en `lib/moderation/raffle.ts`)
```
lista      = identificadores elegibles ordenados
huella     = sha256(lista unida por ",")
para i = 1..N:
  h        = sha256(semilla + ":" + huella + ":" + i)        (hex)
  índice   = (primeros 15 dígitos hex de h como entero) mod tamaño(lista)
  ganador_i = lista[índice]; se retira de la lista
```
El primero es el ganador; los siguientes, suplentes en orden.

## Verificar
Con Node.js y la lista publicada:
```js
import { drawRaffle } from "./lib/moderation/raffle";
drawRaffle("<semilla>", ["XXXX-XXXX", ...], 3);
```
Si `listHash` coincide con la huella publicada y los ganadores coinciden, el sorteo es correcto.
