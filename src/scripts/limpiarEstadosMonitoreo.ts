import dotenv from 'dotenv';
import { connectDB, disconnectDB } from '../utils/db';
import { EstadoMonitoreoComponente } from '../models/EstadoMonitoreoComponente';
import { CatalogoControlMonitoreo } from '../models/CatalogoControlMonitoreo';

// Cargar variables de entorno
dotenv.config();

/**
 * Script para limpiar estados de monitoreo que no tienen controles válidos
 */
async function limpiarEstadosMonitoreo() {
    try {
        console.log('🧹 Iniciando limpieza de estados de monitoreo...');
        
        await connectDB();

        // 1. Obtener todos los controles válidos del catálogo
        const controlesValidos = await CatalogoControlMonitoreo.find({}, 'descripcionCodigo').lean();
        const codigosValidos = controlesValidos.map((control: any) => control.descripcionCodigo);
        
        console.log('📋 Controles válidos encontrados:', codigosValidos);

        // 2. Buscar estados con controles que NO existen en el catálogo
        const estadosInvalidos = await EstadoMonitoreoComponente.find({
            'descripcionCodigo': { $nin: codigosValidos }
        });

        console.log(`❌ Estados con controles inválidos encontrados: ${estadosInvalidos.length}`);
        
        if (estadosInvalidos.length > 0) {
            console.log('📝 Estados a eliminar:');
            estadosInvalidos.forEach((estado: any) => {
                console.log(`   - ID: ${estado._id}, Control: ${estado.descripcionCodigo}, Componente: ${estado.componenteId}`);
            });

            // 3. Eliminar estados inválidos
            const resultado = await EstadoMonitoreoComponente.deleteMany({
                'descripcionCodigo': { $nin: codigosValidos }
            });

            console.log(`✅ Estados eliminados: ${resultado.deletedCount}`);
        } else {
            console.log('✅ No se encontraron estados con controles inválidos');
        }

        // 4. Mostrar resumen de estados restantes
        const estadosRestantes = await EstadoMonitoreoComponente.countDocuments();
        console.log(`📊 Estados de monitoreo restantes: ${estadosRestantes}`);

        // 5. Mostrar estados por control
        const estadosPorControl = await EstadoMonitoreoComponente.aggregate([
            {
                $group: {
                    _id: '$descripcionCodigo',
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        console.log('📈 Estados por control:');
        estadosPorControl.forEach((grupo: any) => {
            console.log(`   - ${grupo._id}: ${grupo.count} estados`);
        });

        console.log('🎉 Limpieza completada exitosamente');

    } catch (error) {
        console.error('❌ Error durante la limpieza:', error);
        throw error;
    } finally {
        await disconnectDB();
        console.log('📡 Desconectado de MongoDB');
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    limpiarEstadosMonitoreo()
        .then(() => {
            console.log('✅ Script de limpieza completado');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Error en script de limpieza:', error);
            process.exit(1);
        });
}

export default limpiarEstadosMonitoreo;