<?php

namespace App\Repository;

use App\Entity\Subscriptions;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Subscriptions>
 */
class SubscriptionsRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Subscriptions::class);
    }

    public function getFollowingUsers(int $userId): array
    {
        $results = $this->createQueryBuilder('s')
            ->select('s', 'u')
            ->join('s.following', 'u')
            ->where('s.follower = :userId')
            ->setParameter('userId', $userId)
            ->getQuery()
            ->getResult();

        // Extract and return the User entities from the Subscriptions results
        return array_map(function (Subscriptions $s) {
            return $s->getFollowing();
        }, $results);
    }

    public function findSubscribersOf(User $user): array
    {
        return $this->createQueryBuilder('s')
            ->select('s', 'f')
            ->join('s.follower', 'f')
            ->where('s.following = :user')
            ->setParameter('user', $user)
            ->getQuery()
            ->getResult();
    }

    //    /**
    //     * @return Subscriptions[] Returns an array of Subscriptions objects
    //     */
    //    public function findByExampleField($value): array
    //    {
    //        return $this->createQueryBuilder('s')
    //            ->andWhere('s.exampleField = :val')
    //            ->setParameter('val', $value)
    //            ->orderBy('s.id', 'ASC')
    //            ->setMaxResults(10)
    //            ->getQuery()
    //            ->getResult()
    //        ;
    //    }

    //    public function findOneBySomeField($value): ?Subscriptions
    //    {
    //        return $this->createQueryBuilder('s')
    //            ->andWhere('s.exampleField = :val')
    //            ->setParameter('val', $value)
    //            ->getQuery()
    //            ->getOneOrNullResult()
    //        ;
    //    }
}
